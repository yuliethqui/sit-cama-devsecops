import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { Role } from '../src/auth/roles.decorator';

jest.setTimeout(30000);

describe('HU-05/HU-06: HTTP, PostgreSQL, roles, auditoría y concurrencia real', () => {
  const schema = `sitcama_beds_test_${randomUUID().replace(/-/g, '')}`;
  const roles: Role[] = ['ENFERMERO', 'MEDICO', 'ADMISIONES', 'COORDINADOR', 'SERVICIOS', 'AUDITOR'];
  const originalEnv = { ...process.env };
  const tokens = {} as Record<Role, string>;
  const actors = {} as Record<Role, string>;
  const apps: INestApplication[] = [];
  const urls: string[] = [];
  let admin: Pool; let sql: Pool; let baseline: unknown; let created = false;
  async function snapshot() {
    const result: Record<string, unknown> = {};
    for (const table of ['users', 'beds', 'bed_assignments', 'patients', 'triage_records', 'audit_events']) {
      const exists = await admin.query('SELECT to_regclass($1) AS name', [`public.${table}`]);
      if (exists.rows[0].name) result[table] = (await admin.query(`SELECT count(*)::integer AS count,
        md5(string_agg(row_to_json(t)::text,',' ORDER BY id)) AS fingerprint FROM public.${table} t`)).rows[0];
    }
    return result;
  }
  async function request(path: string, method = 'GET', role?: Role, body?: unknown, server = 0) {
    const response = await fetch(`${urls[server]}/api${path}`, { method, headers: {
      ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  }
  async function patient(level: 'I' | 'II' | null = 'I') {
    const registered = await request('/patients', 'POST', 'ENFERMERO', {
      document: `BED-${randomUUID().replace(/-/g, '')}`, fullName: 'Persona Sintética HU05 HU06',
      triage: { chiefComplaint: 'Prueba ficticia de camas', spo2: level === 'I' ? 84 : 98, glasgow: 15, eva: level === 'II' ? 8 : 1, paroInminente: false, dolorToracicoTipico: false },
    });
    expect(registered.status).toBe(201); return registered.body.patientId as string;
  }
  async function bed(status = 'AVAILABLE', service = 'URGENCIAS_ADULTOS') {
    const code = `TEST-${randomUUID().slice(0, 8)}`;
    await sql.query('INSERT INTO beds(code,service,status) VALUES($1,$2,$3)', [code, service, status]); return code;
  }
  async function find(code: string) { return (await request('/beds', 'GET', 'SERVICIOS')).body.find((item: any) => item.code === code); }
  async function assign(code: string, patientId: string, server = 0, service = 'URGENCIAS_ADULTOS') {
    return request(`/beds/${code}/assign`, 'POST', 'MEDICO', { patientId, service }, server);
  }
  async function occupied() {
    const code = await bed(); const patientId = await patient(); const assigned = await assign(code, patientId);
    expect(assigned.status).toBe(201); return { code, patientId, assignmentId: assigned.body.assignment.id as string };
  }
  async function cleaning() {
    const item = await occupied();
    const released = await request(`/beds/${item.code}/release`, 'POST', 'MEDICO', { assignmentId: item.assignmentId });
    expect(released.status).toBe(200); return { ...item, version: released.body.bed.updated_at as string };
  }
  async function auditFails(action: string, work: () => Promise<void>) {
    await sql.query(`CREATE FUNCTION reject_bed_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='${action}' THEN RAISE EXCEPTION 'fallo sintético'; END IF; RETURN NEW; END $$`);
    await sql.query('CREATE TRIGGER reject_bed_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_bed_audit()');
    try { await work(); } finally { await sql.query('DROP TRIGGER reject_bed_audit ON audit_events'); await sql.query('DROP FUNCTION reject_bed_audit()'); }
  }

  beforeAll(async () => {
    const envPath = resolve(__dirname, '../../../.env');
    const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
    const connection = { host: process.env.TEST_PGHOST || '127.0.0.1', port: Number(process.env.TEST_PGPORT || 5432),
      database: process.env.TEST_PGDATABASE || env.POSTGRES_DB || 'sitcama', user: process.env.TEST_PGUSER || env.POSTGRES_USER || 'sitcama',
      password: process.env.TEST_PGPASSWORD ?? env.POSTGRES_PASSWORD, connectionTimeoutMillis: 5000 };
    admin = new Pool(connection); baseline = await snapshot();
    await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
    sql = new Pool({ ...connection, options: `-c search_path=${schema}` });
    await sql.query(readFileSync(resolve(__dirname, '../db/001_initial.sql'), 'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
    Object.assign(process.env, { PGHOST: connection.host, PGPORT: String(connection.port), PGDATABASE: connection.database, PGUSER: connection.user,
      PGPASSWORD: connection.password, PGOPTIONS: `-c search_path=${schema}`, JWT_SECRET: randomBytes(48).toString('base64'),
      PATIENT_DATA_KEY: randomBytes(32).toString('base64'), PATIENT_HMAC_KEY: randomBytes(32).toString('base64') });
    const hash = await argon2.hash(randomBytes(24).toString('base64'));
    for (const role of roles) { actors[role] = randomUUID(); await sql.query('INSERT INTO users(id,email,role,password_hash) VALUES($1,$2,$3,$4)', [actors[role], `${role.toLowerCase()}@beds.test`, role, hash]); }
    for (let i = 0; i < 2; i++) {
      const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false }); configureApp(app); await app.listen(0, '127.0.0.1');
      apps.push(app); urls.push(await app.getUrl());
    }
    for (const role of roles) tokens[role] = await apps[0].get(JwtService).signAsync({ sub: actors[role], role });
  });
  afterAll(async () => {
    try {
      for (const app of apps) await app.close(); await sql?.end();
      if (created) { if (!/^sitcama_beds_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Esquema inválido');
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`); expect(await snapshot()).toEqual(baseline); }
    } finally {
      await admin?.end(); for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]; Object.assign(process.env, originalEnv);
    }
  });

  it('conserva el inventario inicial de 38 camas y el censo no expone pacientes', async () => {
    const response = await request('/beds', 'GET', 'SERVICIOS'); expect(response.status).toBe(200); expect(response.body).toHaveLength(38);
    expect(Object.keys(response.body[0]).sort()).toEqual(['code', 'service', 'status', 'updated_at']);
    expect(response.body[0].updated_at).toMatch(/\.\d{6}Z$/);
  });
  it.each(['I', 'II'] as const)('asigna un paciente %s y permite revisión auditada de la ocupación solo al médico', async level => {
    const code = await bed(); const patientId = await patient(level); const response = await assign(code, patientId);
    expect(response.status).toBe(201); expect(response.body.bed.status).toBe('OCCUPIED'); expect(response.body.assignment.patientId).toBe(patientId);
    const detail = await request(`/beds/${code}/assignment`, 'GET', 'MEDICO'); expect(detail.status).toBe(200); expect(detail.body.assignment.id).toBe(response.body.assignment.id);
    expect(detail.body).not.toHaveProperty('fullName');
    const events = (await sql.query('SELECT actor_id,action,new_state FROM audit_events WHERE entity_id=$1 ORDER BY id', [code])).rows;
    expect(events.map(e => e.action)).toEqual(['ASSIGN_BED', 'READ_BED_ASSIGNMENT']); expect(events[0].actor_id).toBe(actors.MEDICO);
  });
  it('completa OCCUPIED → CLEANING → AVAILABLE con historial, actor y tiempo de limpieza', async () => {
    const item = await cleaning();
    const response = await request(`/beds/${item.code}/complete-cleaning`, 'POST', 'SERVICIOS', { expectedUpdatedAt: item.version });
    expect(response.status).toBe(201); expect(response.body.status).toBe('AVAILABLE');
    expect((await sql.query('SELECT released_at FROM bed_assignments WHERE id=$1', [item.assignmentId])).rows[0].released_at).not.toBeNull();
    const events = (await sql.query('SELECT action,actor_id,new_state FROM audit_events WHERE entity_id=$1 ORDER BY id', [item.code])).rows;
    expect(events.map(e => e.action)).toEqual(['ASSIGN_BED', 'RELEASE_BED', 'COMPLETE_CLEANING']);
    expect(events[2].actor_id).toBe(actors.SERVICIOS); expect(events[2].new_state.cleaningSeconds).toBeGreaterThanOrEqual(0);
  });
  it.each(roles)('aplica la matriz RBAC completa para %s', async role => {
    const code = await bed(); const patientId = await patient();
    expect((await request(`/beds/${code}/assign`, 'POST', role, { patientId, service: 'URGENCIAS_ADULTOS' })).status).toBe(role === 'MEDICO' ? 201 : 403);
    expect((await request(`/beds/${code}/assignment`, 'GET', role)).status).toBe(role === 'MEDICO' ? 200 : 403);
    const used = await occupied();
    expect((await request(`/beds/${used.code}/release`, 'POST', role, { assignmentId: used.assignmentId })).status).toBe(role === 'MEDICO' ? 200 : 403);
    const clean = await cleaning();
    expect((await request(`/beds/${clean.code}/complete-cleaning`, 'POST', role, { expectedUpdatedAt: clean.version })).status).toBe(role === 'SERVICIOS' ? 201 : 403);
    expect((await request('/beds', 'GET', role)).status).toBe(200);
  });
  it('exige JWT y rechaza DTO inválidos/campos de autorización del cliente', async () => {
    for (const [path, method] of [['/beds/UA-01/assign', 'POST'], ['/beds/UA-01/release', 'POST'], ['/beds/UA-01/complete-cleaning', 'POST'], ['/beds/UA-01/assignment', 'GET']]) {
      expect((await request(path, method)).status).toBe(401);
    }
    expect((await request('/beds/UA-01/assign', 'POST', 'MEDICO', { patientId: 'bad', service: 'URGENCIAS_ADULTOS' })).status).toBe(400);
    expect((await request('/beds/UA-01/assign', 'POST', 'MEDICO', { patientId: randomUUID(), service: 'OTHER' })).status).toBe(400);
    expect((await request('/beds/UA-01/assign', 'POST', 'MEDICO', { patientId: randomUUID(), service: 'URGENCIAS_ADULTOS', role: 'MEDICO' })).status).toBe(400);
    expect((await request('/beds/UA-01/release', 'POST', 'MEDICO', {})).status).toBe(400);
    expect((await request('/beds/UA-01/complete-cleaning', 'POST', 'SERVICIOS', {})).status).toBe(400);
    expect((await request('/beds/UA-01/complete-cleaning', 'POST', 'SERVICIOS', { expectedUpdatedAt: 'invalid' })).status).toBe(400);
  });
  it('rechaza cama/paciente inexistente, servicio incompatible y triaje pendiente o inexistente', async () => {
    const code = await bed(); const patientId = await patient();
    expect((await assign(code, randomUUID())).status).toBe(404);
    expect((await assign('NONE', patientId)).status).toBe(404);
    expect((await request('/beds/NONE/assignment', 'GET', 'MEDICO')).status).toBe(404);
    expect((await assign(code, patientId, 0, 'AISLAMIENTO')).status).toBe(409);
    expect((await assign(code, await patient(null))).status).toBe(409);
    const noTriage = randomUUID(); await sql.query('INSERT INTO patients(id) VALUES($1)', [noTriage]);
    expect((await assign(code, noTriage)).status).toBe(409);
    await sql.query("UPDATE triage_records SET level='III' WHERE patient_id=$1", [patientId]);
    expect((await assign(code, patientId)).status).toBe(409);
    await sql.query("UPDATE triage_records SET level='I',requires_clinical_review=true WHERE patient_id=$1", [patientId]);
    expect((await assign(code, patientId)).status).toBe(409);
    expect((await find(code)).status).toBe('AVAILABLE');
  });
  it('evalúa el último triaje y no uno I antiguo', async () => {
    const patientId = await patient();
    const response = await request(`/patients/${patientId}/triage`, 'POST', 'MEDICO', { chiefComplaint: 'Caso sintético pendiente', spo2: 98, glasgow: 15, eva: 1, paroInminente: false, dolorToracicoTipico: false });
    expect(response.status).toBe(201); expect((await assign(await bed(), patientId)).status).toBe(409);
  });
  it.each(['OCCUPIED', 'CLEANING', 'BLOCKED'])('no asigna una cama %s ni inventa desbloqueos', async status => {
    const code = await bed(status); expect((await assign(code, await patient())).status).toBe(409);
    if (status === 'BLOCKED') {
      expect((await request(`/beds/${code}/release`, 'POST', 'MEDICO', { assignmentId: randomUUID() })).status).toBe(409);
      expect((await request(`/beds/${code}/complete-cleaning`, 'POST', 'SERVICIOS', { expectedUpdatedAt: (await find(code)).updated_at })).status).toBe(409);
    }
  });
  it('rechaza ocupación o confirmación de limpieza obsoletas, incluidas vueltas completas del ciclo', async () => {
    const item = await cleaning();
    expect((await request(`/beds/${item.code}/release`, 'POST', 'MEDICO', { assignmentId: item.assignmentId })).status).toBe(409);
    expect((await request(`/beds/${item.code}/complete-cleaning`, 'POST', 'SERVICIOS', { expectedUpdatedAt: '2000-01-01T00:00:00.000000Z' })).status).toBe(409);
    expect((await request(`/beds/${item.code}/complete-cleaning`, 'POST', 'SERVICIOS', { expectedUpdatedAt: item.version })).status).toBe(201);
    const second = await assign(item.code, await patient()); expect(second.status).toBe(201);
    expect((await request(`/beds/${item.code}/release`, 'POST', 'MEDICO', { assignmentId: item.assignmentId })).status).toBe(409);
    const released = await request(`/beds/${item.code}/release`, 'POST', 'MEDICO', { assignmentId: second.body.assignment.id }); expect(released.status).toBe(200);
    expect((await request(`/beds/${item.code}/complete-cleaning`, 'POST', 'SERVICIOS', { expectedUpdatedAt: item.version })).status).toBe(409);
    expect((await find(item.code)).status).toBe('CLEANING');
  });
  it('no completa limpieza de una cama disponible u ocupada y detecta inconsistencias heredadas', async () => {
    const code = await bed(); const initial = await find(code);
    expect((await request(`/beds/${code}/complete-cleaning`, 'POST', 'SERVICIOS', { expectedUpdatedAt: initial.updated_at })).status).toBe(409);
    expect((await request(`/beds/${code}/assignment`, 'GET', 'MEDICO')).body.assignment).toBeNull();
    const used = await occupied();
    expect((await request(`/beds/${used.code}/release`, 'POST', 'MEDICO', { assignmentId: randomUUID() })).status).toBe(409);
    await sql.query("UPDATE beds SET status='AVAILABLE' WHERE code=$1", [used.code]);
    expect((await assign(used.code, await patient())).status).toBe(409);
    await sql.query("UPDATE beds SET status='CLEANING' WHERE code=$1", [used.code]);
    expect((await request(`/beds/${used.code}/complete-cleaning`, 'POST', 'SERVICIOS', { expectedUpdatedAt: (await find(used.code)).updated_at })).status).toBe(409);
    const orphan = await bed('OCCUPIED'); expect((await request(`/beds/${orphan}/release`, 'POST', 'MEDICO', { assignmentId: randomUUID() })).status).toBe(409);
  });
  it('dos instancias: varios pacientes compiten por una cama y solo una asignación confirma', async () => {
    const code = await bed(); const patients = await Promise.all(Array.from({ length: 6 }, () => patient()));
    const responses = await Promise.all(patients.map((id, i) => assign(code, id, i % 2)));
    expect(responses.map(r => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
    expect((await sql.query('SELECT count(*)::integer AS count FROM bed_assignments a JOIN beds b ON b.id=a.bed_id WHERE b.code=$1 AND a.released_at IS NULL', [code])).rows[0].count).toBe(1);
    expect((await sql.query("SELECT count(*)::integer AS count FROM audit_events WHERE entity_id=$1 AND action='ASSIGN_BED'", [code])).rows[0].count).toBe(1);
  });
  it('dos instancias: un paciente compite por varias camas y solo una asignación confirma', async () => {
    const patientId = await patient(); const codes = await Promise.all(Array.from({ length: 6 }, () => bed()));
    const responses = await Promise.all(codes.map((code, i) => assign(code, patientId, i % 2)));
    expect(responses.map(r => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
    expect((await sql.query('SELECT count(*)::integer AS count FROM bed_assignments WHERE patient_id=$1 AND released_at IS NULL', [patientId])).rows[0].count).toBe(1);
  });
  it('serializa liberación y limpieza concurrentes: una confirma y la otra recibe 409', async () => {
    const item = await occupied();
    const releases = await Promise.all([0, 1].map(server => request(`/beds/${item.code}/release`, 'POST', 'MEDICO', { assignmentId: item.assignmentId }, server)));
    expect(releases.map(r => r.status).sort()).toEqual([200, 409]);
    const version = (await find(item.code)).updated_at;
    const clean = await Promise.all([0, 1].map(server => request(`/beds/${item.code}/complete-cleaning`, 'POST', 'SERVICIOS', { expectedUpdatedAt: version }, server)));
    expect(clean.map(r => r.status).sort()).toEqual([201, 409]);
  });
  it('el fallo de auditoría revierte asignación, liberación, limpieza y lectura', async () => {
    const code = await bed(); const patientId = await patient();
    await auditFails('ASSIGN_BED', async () => { expect((await assign(code, patientId)).status).toBe(500); });
    expect((await find(code)).status).toBe('AVAILABLE');
    expect((await sql.query('SELECT count(*)::integer AS count FROM bed_assignments WHERE patient_id=$1', [patientId])).rows[0].count).toBe(0);
    const assigned = await assign(code, patientId); expect(assigned.status).toBe(201);
    await auditFails('RELEASE_BED', async () => { expect((await request(`/beds/${code}/release`, 'POST', 'MEDICO', { assignmentId: assigned.body.assignment.id })).status).toBe(500); });
    expect((await find(code)).status).toBe('OCCUPIED'); expect((await sql.query('SELECT released_at FROM bed_assignments WHERE id=$1', [assigned.body.assignment.id])).rows[0].released_at).toBeNull();
    await auditFails('READ_BED_ASSIGNMENT', async () => { expect((await request(`/beds/${code}/assignment`, 'GET', 'MEDICO')).status).toBe(500); });
    const released = await request(`/beds/${code}/release`, 'POST', 'MEDICO', { assignmentId: assigned.body.assignment.id });
    await auditFails('COMPLETE_CLEANING', async () => { expect((await request(`/beds/${code}/complete-cleaning`, 'POST', 'SERVICIOS', { expectedUpdatedAt: released.body.bed.updated_at })).status).toBe(500); });
    expect((await find(code)).status).toBe('CLEANING');
  });
});
