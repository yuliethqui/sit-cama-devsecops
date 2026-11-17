import { BadRequestException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DatabaseService } from '../db/database.service';
import { AccessService } from '../realtime/access.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, AuditQuery } from './audit.dto';

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService, private readonly access: AccessService) {}
  async list(query: AuditQuery, actorId: string, ip: string | null) {
    if (query.cursor && BigInt(query.cursor) > 9223372036854775807n) throw new BadRequestException();
    return this.db.transaction(async client => {
      await this.access.requireRole(actorId, 'AUDITOR', client);
      if (query.from !== undefined || query.to !== undefined) {
        let ordered: boolean | null;
        try {
          // Use the same type/time zone as recorded_at; JS Date loses microseconds.
          const range = await client.query<{ ordered: boolean | null }>(
            'SELECT $1::timestamptz <= $2::timestamptz AS ordered', [query.from ?? null, query.to ?? null]);
          ordered = range.rows[0].ordered;
        } catch (error) {
          if (['22007', '22008', '22009'].includes((error as { code?: string } | null)?.code ?? '')) {
            throw new BadRequestException();
          }
          throw error;
        }
        if (ordered === false) throw new BadRequestException();
      }
      const values: unknown[] = [];
      const where: string[] = [];
      for (const [key, column, operator] of [
        ['from','recorded_at','>='], ['to','recorded_at','<='], ['actorId','actor_id','='],
        ['action','action','='], ['entityType','entity_type','='], ['cursor','id','<'],
      ] as const) {
        if (query[key] !== undefined) { values.push(query[key]); where.push(`${column} ${operator} $${values.length}`); }
      }
      values.push(query.limit + 1);
      // JSON keeps IDs as text; ordering must use the bigint column, like the cursor.
      const rows = await client.query(`SELECT id::text,recorded_at AS "recordedAt",actor_id AS "actorId",
        action,entity_type AS "entityType",entity_id AS "entityId",
        (entity_type='bed' AND EXISTS(SELECT 1 FROM beds WHERE code=entity_id)) AS "knownBed"
        FROM audit_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY audit_events.id DESC LIMIT $${values.length}`, values);
      const more = rows.rows.length > query.limit;
      const items = rows.rows.slice(0, query.limit).map(row => ({
        id: row.id, recordedAt: row.recordedAt, actorId: row.actorId,
        action: AUDIT_ACTIONS.includes(row.action) ? row.action : 'REDACTED',
        entityType: AUDIT_ENTITIES.includes(row.entityType) ? row.entityType : 'REDACTED',
        entityId: this.safeEntity(row) ? row.entityId : 'REDACTED',
      }));
      await client.query(`INSERT INTO audit_events(actor_id,entity_type,entity_id,action,request_ip)
        VALUES($1,'audit','events','READ_AUDIT',$2)`, [actorId, ip]);
      return { items, nextCursor: more ? items[items.length - 1].id : null, limit: query.limit };
    });
  }
  private safeEntity(row: { entityType: string; entityId: string; knownBed: boolean }) {
    switch (row.entityType) {
      case 'patient': return row.entityId === 'unmatched' || isUUID(row.entityId, '4');
      case 'triage': return isUUID(row.entityId, '4');
      case 'bed': return row.knownBed;
      case 'panel': return row.entityId === 'triage';
      case 'audit': return row.entityId === 'events';
      default: return false;
    }
  }
}
