import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';
import { PatientDataService } from './patient-data.service';
import { PatientsService } from './patients.service';

describe('HU-01/HU-03 PatientsService', () => {
  const actor = randomUUID();
  const id = randomUUID();
  const triage = { chiefComplaint: 'Motivo sintético', spo2: 98, glasgow: 15, eva: 1, paroInminente: false, dolorToracicoTipico: false };
  const input = { document: 'DEMO-0001', fullName: 'Persona Sintética', triage };
  const now = new Date();
  const query = jest.fn();
  const client = { query } as unknown as PoolClient;
  const db = { transaction: jest.fn((callback: (c: PoolClient) => Promise<unknown>) => callback(client)) };
  const data = new PatientDataService(new ConfigService({
    PATIENT_DATA_KEY: randomBytes(32).toString('base64'), PATIENT_HMAC_KEY: randomBytes(32).toString('base64'),
  }));
  const service = new PatientsService(db as unknown as DatabaseService, data, { notify: jest.fn().mockResolvedValue(undefined) } as any);
  beforeEach(() => query.mockReset());

  it('registra paciente/triaje/auditorías usando solo parámetros y ciphertext', async () => {
    query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO patients')) return { rows: [{ id: params[0], provisional: false, created_at: now }] };
      if (sql.includes('INSERT INTO triage_records')) return { rows: [{ id: params[0], level: null, max_wait_minutes: null,
        requires_clinical_review: true, created_at: now, elapsed_minutes: 0 }] };
      return { rows: [] };
    });
    const result = await service.register(input, actor, null);
    expect(result.triage).toMatchObject({ level: null, maxWaitMinutes: null, requiresClinicalReview: true, demoOnly: true });
    const patientParams = query.mock.calls[0][1];
    expect(patientParams[1]).toBe(data.documentHmac(input.document));
    expect(data.decrypt(patientParams[2], `identity:${result.patientId}`)).toEqual({ document: input.document, fullName: input.fullName });
    const triageCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO triage_records'))!;
    expect(data.decrypt(triageCall[1][4], `triage:${result.patientId}:${result.triage.id}`)).toEqual(triage);
    for (const [sql, params] of query.mock.calls) {
      expect(sql).not.toContain(input.document);
      expect(sql).not.toContain(triage.chiefComplaint);
      if (sql.includes('INSERT INTO audit_events')) {
        expect(JSON.stringify(params)).not.toMatch(/DEMO-0001|Persona|Motivo|spo2|level|document_hmac/);
      }
    }
  });

  it('traduce exclusivamente el conflicto de documento, sin eco de valores', async () => {
    query.mockRejectedValue({ code: '23505', constraint: 'patients_document_hmac_key', detail: input.document });
    await expect(service.register(input, actor, '127.0.0.1')).rejects.toMatchObject({ status: 409 });
    const other = { code: '23505', constraint: 'another_constraint' };
    query.mockRejectedValue(other);
    await expect(service.register(input, actor, null)).rejects.toBe(other);
    query.mockRejectedValue(null);
    await expect(service.register(input, actor, null)).rejects.toBeNull();
  });

  it('no crea triaje para un paciente inexistente', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(service.recordTriage(id, triage, actor, null)).rejects.toMatchObject({ status: 404 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('audita búsquedas sin resultados antes del 404', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(service.search(input.document, actor, null)).rejects.toMatchObject({ status: 404 });
    expect(query.mock.calls[0][1]).toEqual([data.documentHmac(input.document)]);
    expect(query.mock.calls[1][1]).toEqual([actor, 'patient', 'unmatched', 'SEARCH_PATIENT', '{"matched":false}', null]);
  });

  it('maneja pacientes existentes sin triaje', async () => {
    query.mockResolvedValueOnce({ rows: [{ id, provisional: false, created_at: now, triage_id: null }] }).mockResolvedValue({ rows: [] });
    await expect(service.search(input.document, actor, null)).resolves.toMatchObject({ patientId: id, latestTriage: null, triageStatus: 'PENDING_TRIAGE' });
  });

  it('mantiene pendiente un nivel nulo aunque un registro antiguo tenga bandera false', async () => {
    query.mockResolvedValueOnce({ rows: [{ id, provisional: false, created_at: now, triage_id: randomUUID(), level: null,
      max_wait_minutes: null, requires_clinical_review: false, triage_created_at: now, elapsed_minutes: 10 }] }).mockResolvedValue({ rows: [] });
    await expect(service.search(input.document, actor, null)).resolves.toMatchObject({ triageStatus: 'PENDING_CLINICAL_REVIEW',
      latestTriage: { requiresClinicalReview: true, elapsedMinutes: 10 } });
  });

  it('devuelve 404 si no hay un triaje para lectura', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(service.latestTriage(id, actor, null)).rejects.toMatchObject({ status: 404 });
  });
});
