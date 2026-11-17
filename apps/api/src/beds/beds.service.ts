import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../db/database.service';
import { AssignBedDto } from './beds.dto';

export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'BLOCKED';
export interface BedRow extends QueryResultRow { code: string; service: string; status: BedStatus; updated_at: string }
interface LockedBed extends BedRow { id: string; elapsed_seconds: number }
interface AssignmentRow extends QueryResultRow { id: string; patient_id: string; assigned_at: Date }
// Preserve full timestamp precision: the client echoes updated_at as a cleaning-cycle token.
const BED_COLUMNS = `code,service,status,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at`;

@Injectable()
export class BedsService {
  constructor(private readonly db: DatabaseService) {}

  async list(service?: string, status?: BedStatus): Promise<BedRow[]> {
    return (await this.db.query<BedRow>(`SELECT ${BED_COLUMNS} FROM beds
      WHERE ($1::text IS NULL OR service=$1) AND ($2::text IS NULL OR status=$2) ORDER BY service,code`,
    [service || null, status || null])).rows;
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction(async client => {
        await client.query("SET LOCAL lock_timeout = '5s'");
        return operation(client);
      });
    } catch (error) {
      const pg = error as { code?: string; constraint?: string };
      if ((pg.code === '23505' && ['one_active_patient_per_bed', 'one_active_bed_per_patient'].includes(pg.constraint!)) ||
        ['55P03', '40P01'].includes(pg.code!)) throw new ConflictException('La cama o el paciente cambió de estado');
      throw error;
    }
  }

  private async lockBed(client: PoolClient, code: string): Promise<LockedBed> {
    const result = await client.query<LockedBed>(`SELECT id,${BED_COLUMNS},
      GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (clock_timestamp()-updated_at))))::integer AS elapsed_seconds
      FROM beds WHERE code=$1 FOR UPDATE`, [code]);
    if (!result.rows[0]) throw new NotFoundException('Cama inexistente');
    return result.rows[0];
  }

  private view(bed: BedRow): BedRow {
    return { code: bed.code, service: bed.service, status: bed.status, updated_at: bed.updated_at };
  }

  private async active(client: PoolClient, bedId: string): Promise<AssignmentRow | undefined> {
    return (await client.query<AssignmentRow>(`SELECT id,patient_id,assigned_at FROM bed_assignments
      WHERE bed_id=$1 AND released_at IS NULL FOR UPDATE`, [bedId])).rows[0];
  }

  private async audit(client: PoolClient, code: string, actorId: string, ip: string | null,
    action: string, previous: Record<string, unknown>, next: Record<string, unknown>): Promise<void> {
    await client.query(`INSERT INTO audit_events(actor_id,entity_type,entity_id,action,previous_state,new_state,request_ip)
      VALUES($1,'bed',$2,$3,$4::jsonb,$5::jsonb,$6)`, [actorId, code, action, JSON.stringify(previous), JSON.stringify(next), ip]);
  }

  async assign(code: string, input: AssignBedDto, actorId: string, ip: string | null) {
    return this.transaction(async client => {
      // Serialize the same patient before locking any bed; triage writes use this same lock.
      const patient = await client.query('SELECT id FROM patients WHERE id=$1 FOR UPDATE', [input.patientId]);
      if (!patient.rows.length) throw new NotFoundException('Paciente inexistente');
      const bed = await this.lockBed(client, code);
      if (bed.status !== 'AVAILABLE' || bed.service !== input.service) throw new ConflictException('Cama no disponible o servicio incompatible');
      const occupied = await client.query('SELECT id FROM bed_assignments WHERE released_at IS NULL AND (bed_id=$1 OR patient_id=$2)', [bed.id, input.patientId]);
      if (occupied.rows.length) throw new ConflictException('El paciente o la cama ya tiene una asignación activa');
      const triage = (await client.query<{ level: string | null; requires_clinical_review: boolean }>(
        'SELECT level,requires_clinical_review FROM triage_records WHERE patient_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [input.patientId])).rows[0];
      if (!triage || !['I', 'II'].includes(triage.level!) || triage.requires_clinical_review) throw new ConflictException('El MVP requiere un triaje I/II registrado');
      const assignment = (await client.query<AssignmentRow>(`INSERT INTO bed_assignments(bed_id,patient_id,assigned_by,assigned_at)
        VALUES($1,$2,$3,clock_timestamp()) RETURNING id,patient_id,assigned_at`, [bed.id, input.patientId, actorId])).rows[0];
      const changed = (await client.query<BedRow>(`UPDATE beds SET status='OCCUPIED',updated_at=clock_timestamp() WHERE id=$1 RETURNING ${BED_COLUMNS}`, [bed.id])).rows[0];
      await this.audit(client, code, actorId, ip, 'ASSIGN_BED', { status: bed.status }, { status: changed.status, assignmentId: assignment.id, patientId: input.patientId, service: bed.service });
      return { bed: this.view(changed), assignment: { id: assignment.id, patientId: assignment.patient_id, assignedAt: assignment.assigned_at }, demoOnly: true };
    });
  }

  async assignment(code: string, actorId: string, ip: string | null) {
    return this.transaction(async client => {
      const bed = await this.lockBed(client, code);
      const assignment = await this.active(client, bed.id);
      await this.audit(client, code, actorId, ip, 'READ_BED_ASSIGNMENT', {}, { matched: Boolean(assignment) });
      return { bed: this.view(bed), assignment: assignment ? { id: assignment.id, patientId: assignment.patient_id, assignedAt: assignment.assigned_at } : null };
    });
  }

  async release(code: string, assignmentId: string, actorId: string, ip: string | null) {
    return this.transaction(async client => {
      const bed = await this.lockBed(client, code);
      const assignment = await this.active(client, bed.id);
      if (bed.status !== 'OCCUPIED' || !assignment || assignment.id !== assignmentId) throw new ConflictException('La ocupación revisada ya no está vigente');
      await client.query('UPDATE bed_assignments SET released_at=clock_timestamp() WHERE id=$1 AND released_at IS NULL', [assignment.id]);
      const changed = (await client.query<BedRow>(`UPDATE beds SET status='CLEANING',updated_at=clock_timestamp() WHERE id=$1 RETURNING ${BED_COLUMNS}`, [bed.id])).rows[0];
      await this.audit(client, code, actorId, ip, 'RELEASE_BED', { status: bed.status, assignmentId }, { status: changed.status, assignmentId });
      return { bed: this.view(changed), assignmentId };
    });
  }

  async completeCleaning(code: string, expectedUpdatedAt: string, actorId: string, ip: string | null): Promise<BedRow> {
    return this.transaction(async client => {
      const bed = await this.lockBed(client, code);
      if (bed.status !== 'CLEANING' || await this.active(client, bed.id)) throw new ConflictException('La cama no está lista para completar limpieza');
      const changed = (await client.query<BedRow>(`UPDATE beds SET status='AVAILABLE',updated_at=clock_timestamp()
        WHERE id=$1 AND updated_at=$2::timestamptz RETURNING ${BED_COLUMNS}`, [bed.id, expectedUpdatedAt])).rows[0];
      if (!changed) throw new ConflictException('El ciclo de limpieza revisado ya no está vigente');
      await this.audit(client, code, actorId, ip, 'COMPLETE_CLEANING', { status: bed.status, cleaningStartedAt: bed.updated_at }, { status: changed.status, cleaningSeconds: bed.elapsed_seconds });
      return this.view(changed);
    });
  }
}
