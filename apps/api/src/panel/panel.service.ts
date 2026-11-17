import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { AccessService } from '../realtime/access.service';
import { PanelQuery } from './panel.dto';

const recent = `WITH latest AS (
 SELECT DISTINCT ON (patient_id) id,patient_id,level,max_wait_minutes,requires_clinical_review,created_at
 FROM triage_records WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
 ORDER BY patient_id,created_at DESC,id DESC
), panel AS (SELECT *, CASE WHEN NOT requires_clinical_review AND level IN ('I','II') THEN level ELSE NULL END AS demo_level FROM latest)`;

@Injectable()
export class PanelService {
  constructor(private readonly db: DatabaseService, private readonly access: AccessService) {}
  async list(query: PanelQuery, actorId: string, ip: string | null) {
    return this.db.transaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await this.access.requireRole(actorId, 'MEDICO', client);
      const counts = await client.query(`${recent} SELECT count(*)::int AS total,
        count(*) FILTER(WHERE demo_level='I')::int AS "levelI",
        count(*) FILTER(WHERE demo_level='II')::int AS "levelII",
        count(*) FILTER(WHERE demo_level IS NULL)::int AS pending FROM panel`);
      const rows = await client.query(`${recent} SELECT patient_id AS "patientId",id AS "triageId",
        demo_level AS level,CASE WHEN demo_level IS NULL THEN NULL ELSE max_wait_minutes END AS "maxWaitMinutes",
        demo_level IS NULL AS "requiresClinicalReview",created_at AS "createdAt",
        GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-created_at))/60))::int AS "elapsedMinutes"
        FROM panel ORDER BY CASE demo_level WHEN 'I' THEN 1 WHEN 'II' THEN 2 ELSE 3 END,created_at,id
        LIMIT $1 OFFSET $2`, [query.limit, (query.page - 1) * query.limit]);
      await client.query(`INSERT INTO audit_events(actor_id,entity_type,entity_id,action,request_ip)
        VALUES($1,'panel','triage','READ_TRIAGE_PANEL',$2)`, [actorId, ip]);
      return { items: rows.rows.map(row => ({ ...row, demoOnly: true })), totals: counts.rows[0],
        page: query.page, limit: query.limit, windowHours: 24, demoOnly: true };
    });
  }
}
