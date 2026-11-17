import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../db/database.service';
import { classifyTriage } from '../triage/triage.engine';
import { PatientDataService } from './patient-data.service';
import { RecordTriageDto, RegisterPatientDto } from './patients.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

interface PatientRow extends QueryResultRow { id: string; provisional: boolean; created_at: Date }
interface TriageRow extends QueryResultRow {
  id: string; level: 'I' | 'II' | 'III' | 'IV' | 'V' | null;
  max_wait_minutes: number | null; requires_clinical_review: boolean; created_at: Date; elapsed_minutes: number;
}
interface SearchRow extends PatientRow {
  triage_id: string | null; level: TriageRow['level']; max_wait_minutes: number | null;
  requires_clinical_review: boolean | null; triage_created_at: Date | null; elapsed_minutes: number | null;
}

@Injectable()
export class PatientsService {
  constructor(private readonly db: DatabaseService, private readonly data: PatientDataService,
    private readonly realtime: RealtimeGateway) {}

  private summary(row: TriageRow) {
    return {
      id: row.id, level: row.level, maxWaitMinutes: row.max_wait_minutes,
      requiresClinicalReview: row.requires_clinical_review || row.level === null,
      createdAt: row.created_at, elapsedMinutes: row.elapsed_minutes, demoOnly: true,
    };
  }

  private async audit(client: PoolClient, actorId: string, entityType: string, entityId: string,
    action: string, requestIp: string | null, metadata: Record<string, unknown> = {}): Promise<void> {
    // No document, HMAC, name, symptoms, signs or classification in audit metadata.
    await client.query(
      `INSERT INTO audit_events(actor_id,entity_type,entity_id,action,new_state,request_ip)
       VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
      [actorId, entityType, entityId, action, JSON.stringify(metadata), requestIp],
    );
  }

  private async insertTriage(client: PoolClient, patientId: string, input: RecordTriageDto,
    actorId: string, requestIp: string | null) {
    const id = randomUUID();
    const assessment = classifyTriage(input);
    const ciphertext = this.data.encrypt(input, `triage:${patientId}:${id}`);
    const result = await client.query<TriageRow>(
      `INSERT INTO triage_records(id,patient_id,level,max_wait_minutes,clinical_payload_ciphertext,
        requires_clinical_review,created_by,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp())
       RETURNING id,level,max_wait_minutes,requires_clinical_review,created_at,0 AS elapsed_minutes`,
      [id, patientId, assessment.level, assessment.maxWaitMinutes, ciphertext, assessment.requiresClinicalReview, actorId],
    );
    await this.audit(client, actorId, 'triage', id, 'RECORD_TRIAGE', requestIp, { patientId });
    return this.summary(result.rows[0]);
  }

  async register(input: RegisterPatientDto, actorId: string, requestIp: string | null) {
    const id = randomUUID();
    const document = input.document.trim().toUpperCase();
    const hmac = this.data.documentHmac(document);
    const ciphertext = this.data.encrypt({ document, fullName: input.fullName }, `identity:${id}`);
    try {
      const saved = await this.db.transaction(async (client) => {
        const result = await client.query<PatientRow>(
          `INSERT INTO patients(id,document_hmac,identity_ciphertext,provisional) VALUES($1,$2,$3,false)
           RETURNING id,provisional,created_at`, [id, hmac, ciphertext],
        );
        await this.audit(client, actorId, 'patient', id, 'REGISTER_PATIENT', requestIp, { provisional: false });
        const triage = await this.insertTriage(client, id, input.triage, actorId, requestIp);
        return { patientId: id, provisional: result.rows[0].provisional, createdAt: result.rows[0].created_at, triage };
      });
      await this.realtime.notify(saved.triage.level === 'I').catch(() => undefined);
      return saved;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string } | null;
      if (pgError?.code === '23505' && pgError.constraint === 'patients_document_hmac_key') {
        throw new ConflictException('El paciente ya está registrado');
      }
      throw error;
    }
  }

  async recordTriage(patientId: string, input: RecordTriageDto, actorId: string, requestIp: string | null) {
    const saved = await this.db.transaction(async (client) => {
      const patient = await client.query('SELECT id FROM patients WHERE id=$1 FOR UPDATE', [patientId]);
      if (!patient.rows.length) throw new NotFoundException('Paciente no encontrado');
      return { patientId, triage: await this.insertTriage(client, patientId, input, actorId, requestIp) };
    });
    await this.realtime.notify(saved.triage.level === 'I').catch(() => undefined);
    return saved;
  }

  async search(document: string, actorId: string, requestIp: string | null) {
    const hmac = this.data.documentHmac(document);
    const row = await this.db.transaction(async (client) => {
      const result = await client.query<SearchRow>(
        `SELECT p.id,p.provisional,p.created_at,t.id AS triage_id,t.level,t.max_wait_minutes,
          t.requires_clinical_review,t.created_at AS triage_created_at,
          GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-t.created_at))/60))::integer AS elapsed_minutes
         FROM patients p LEFT JOIN LATERAL (
           SELECT id,level,max_wait_minutes,requires_clinical_review,created_at FROM triage_records
           WHERE patient_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1
         ) t ON true WHERE p.document_hmac=$1 LIMIT 1`, [hmac],
      );
      const found = result.rows[0];
      await this.audit(client, actorId, 'patient', found?.id ?? 'unmatched', 'SEARCH_PATIENT', requestIp,
        { matched: Boolean(found) });
      return found;
    });
    // Commit the access audit even when the exact search did not match.
    if (!row) throw new NotFoundException('Paciente no encontrado');
    const latestTriage = row.triage_id ? this.summary({
      id: row.triage_id, level: row.level, max_wait_minutes: row.max_wait_minutes,
      requires_clinical_review: row.requires_clinical_review!, created_at: row.triage_created_at!,
      elapsed_minutes: row.elapsed_minutes!,
    }) : null;
    return {
      patientId: row.id, provisional: row.provisional, createdAt: row.created_at,
      triageStatus: !latestTriage ? 'PENDING_TRIAGE' : latestTriage.requiresClinicalReview ? 'PENDING_CLINICAL_REVIEW' : 'DEMO_CLASSIFIED',
      latestTriage,
    };
  }

  async latestTriage(patientId: string, actorId: string, requestIp: string | null) {
    return this.db.transaction(async (client) => {
      const result = await client.query<TriageRow & { clinical_payload_ciphertext: Buffer }>(
        `SELECT id,level,max_wait_minutes,requires_clinical_review,created_at,clinical_payload_ciphertext,
          GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-created_at))/60))::integer AS elapsed_minutes
         FROM triage_records WHERE patient_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`, [patientId],
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException('Registro de triaje no encontrado');
      const clinical = this.data.decrypt<RecordTriageDto>(row.clinical_payload_ciphertext, `triage:${patientId}:${row.id}`);
      await this.audit(client, actorId, 'triage', row.id, 'READ_TRIAGE', requestIp, { patientId });
      return { patientId, triage: this.summary(row), clinical };
    });
  }
}
