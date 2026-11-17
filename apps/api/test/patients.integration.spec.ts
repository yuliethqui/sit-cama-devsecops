import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import * as argon2 from 'argon2';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { Role } from '../src/auth/roles.decorator';
import { PatientDataService } from '../src/patients/patient-data.service';

jest.setTimeout(30000);

/** Real HTTP + guards + DTOs + SQL + transactions. Only a freshly created schema is written. */
describe('HU-01/HU-03 integración HTTP con PostgreSQL', () => {
  const schema = `sitcama_test_${randomUUID().replace(/-/g, '')}`;
  const roles: Role[] = ['ENFERMERO', 'MEDICO', 'ADMISIONES', 'COORDINADOR', 'SERVICIOS', 'AUDITOR'];
  const clinical = { chiefComplaint: 'Motivo sintético privado', spo2: 98, glasgow: 15, eva: 1, paroInminente: false, dolorToracicoTipico: false };
  const fixture = { document: 'DEMO-REG-001', fullName: 'Persona Sintética Privada', triage: clinical };
  const password = randomBytes(24).toString('base64');
  const tokens = {} as Record<Role, string>;
  const actors = {} as Record<Role, string>;
  const originalEnv = { ...process.env };
  let app: INestApplication | undefined;
  let admin: Pool;
  let sql: Pool | undefined;
  let schemaCreated = false;
  let baseUrl: string;
  let patientId: string;
  let baseline: unknown;

  async function snapshot() {
    const result: Record<string, unknown> = {};
    for (const table of ['users', 'beds', 'bed_assignments', 'patients', 'triage_records', 'audit_events']) {
      const exists = await admin.query('SELECT to_regclass($1) AS name', [`public.${table}`]);
      if (exists.rows[0].name) {
        // Table names are a fixed allowlist; never select raw personal data into test output.
        result[table] = (await admin.query(`SELECT count(*)::integer AS count,
          md5(string_agg(row_to_json(t)::text,',' ORDER BY id)) AS fingerprint FROM public.${table} t`)).rows[0];
      }
    }
    return result;
  }

  async function request(path: string, method = 'GET', role?: Role, body?: unknown, token?: string) {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method, headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token || role ? { Authorization: `Bearer ${token ?? tokens[role!]}` } : {}),
      }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any, headers: response.headers };
  }

  async function register(triage = clinical) {
    const input = { ...fixture, document: `DEMO-${randomUUID().replace(/-/g, '')}`, triage };
    const response = await request('/patients', 'POST', 'ENFERMERO', input);
    expect(response.status).toBe(201);
    return { input, ...response.body };
  }

  beforeAll(async () => {
    const envPath = resolve(__dirname, '../../../.env');
    const local = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
    const connection = {
      host: process.env.TEST_PGHOST || '127.0.0.1', port: Number(process.env.TEST_PGPORT || 5432),
      database: process.env.TEST_PGDATABASE || local.POSTGRES_DB || 'sitcama',
      user: process.env.TEST_PGUSER || local.POSTGRES_USER || 'sitcama',
      password: process.env.TEST_PGPASSWORD ?? local.POSTGRES_PASSWORD ?? '', connectionTimeoutMillis: 3000,
    };
    admin = new Pool({ ...connection, options: '-c search_path=pg_catalog' });
    try { baseline = await snapshot(); } catch {
      throw new Error('PostgreSQL de pruebas no disponible. Inicie el servicio db o configure TEST_PGHOST/PORT/DATABASE/USER/PASSWORD.');
    }
    // No public fallback: all unqualified SQL, including the initial seed, stays in this new schema.
    await admin.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    sql = new Pool({ ...connection, options: `-c search_path=${schema}` });
    const initial = readFileSync(resolve(__dirname, '../db/001_initial.sql'), 'utf8')
      .replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''); // gen_random_uuid is built into PostgreSQL 17.
    await sql.query(initial);
    Object.assign(process.env, {
      PGHOST: connection.host, PGPORT: String(connection.port), PGDATABASE: connection.database,
      PGUSER: connection.user, PGPASSWORD: connection.password, PGOPTIONS: `-c search_path=${schema}`,
      JWT_SECRET: randomBytes(48).toString('base64'),
      PATIENT_DATA_KEY: randomBytes(32).toString('base64'), PATIENT_HMAC_KEY: randomBytes(32).toString('base64'),
    });
    const hash = await argon2.hash(password);
    for (const role of roles) {
      actors[role] = randomUUID();
      await sql.query('INSERT INTO users(id,email,role,password_hash) VALUES($1,$2,$3,$4)',
        [actors[role], `${role.toLowerCase()}@integration.test`, role, hash]);
    }
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    const jwt = app.get(JwtService);
    for (const role of roles) tokens[role] = await jwt.signAsync({ sub: actors[role], role });
    const first = await request('/patients', 'POST', 'ENFERMERO', fixture);
    expect(first.status).toBe(201);
    patientId = first.body.patientId;
  });

  afterAll(async () => {
    try {
      await app?.close();
      await sql?.end();
      if (schemaCreated) {
        if (!/^sitcama_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Esquema de pruebas inválido');
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
        expect(await snapshot()).toEqual(baseline);
      }
    } finally {
      await admin?.end();
      for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
      Object.assign(process.env, originalEnv);
    }
  });

  it('preserva health, login, preview y el censo de 38 camas', async () => {
    expect((await request('/health')).body).toEqual({ status: 'ok', service: 'sit-cama-api' });
    const login = await request('/auth/login', 'POST', undefined, { email: 'enfermero@integration.test', password });
    expect(login.status).toBe(200);
    expect(login.body.role).toBe('ENFERMERO');
    const beds = await request('/beds', 'GET', undefined, undefined, login.body.access_token);
    expect(beds.status).toBe(200);
    expect(beds.body).toHaveLength(38);
    const preview = await request('/triage/preview', 'POST', 'MEDICO', { ...clinical, chiefComplaint: undefined, spo2: 84 });
    expect(preview.status).toBe(201);
    expect(preview.body).toMatchObject({ level: 'I', maxWaitMinutes: 0, demoOnly: true });
    expect((await request('/auth/login', 'POST', undefined, { email: 'enfermero@integration.test', password: 'incorrecta' })).status).toBe(401);
    expect((await request('/auth/login', 'POST', undefined, { email: 'missing@integration.test', password })).status).toBe(401);
    await sql!.query('UPDATE users SET active=false WHERE id=$1', [actors.AUDITOR]);
    expect((await request('/auth/login', 'POST', undefined, { email: 'auditor@integration.test', password })).status).toBe(401);
    await sql!.query('UPDATE users SET active=true WHERE id=$1', [actors.AUDITOR]);
  });

  it.each(['I', 'II', null])('persiste resultado demo %s sin inventar niveles III-V', async level => {
    const input = level === 'I' ? { ...clinical, spo2: 84 } : level === 'II' ? { ...clinical, eva: 8 } : clinical;
    const saved = await register(input);
    expect(saved.triage).toMatchObject({ level, requiresClinicalReview: level === null,
      maxWaitMinutes: level === 'I' ? 0 : level === 'II' ? 30 : null, demoOnly: true });
    const result = await sql!.query(`SELECT p.document_hmac,p.identity_ciphertext,t.* FROM patients p
      JOIN triage_records t ON t.patient_id=p.id WHERE p.id=$1`, [saved.patientId]);
    const row = result.rows[0];
    const data = app!.get(PatientDataService);
    expect(row.document_hmac).toBe(data.documentHmac(saved.input.document));
    expect(data.decrypt(row.identity_ciphertext, `identity:${saved.patientId}`)).toEqual({ document: saved.input.document.toUpperCase(), fullName: fixture.fullName });
    expect(data.decrypt(row.clinical_payload_ciphertext, `triage:${saved.patientId}:${saved.triage.id}`)).toEqual(input);
    expect(row.created_by).toBe(actors.ENFERMERO);
    expect(row.level).toBe(level);
    const stored = JSON.stringify(row);
    expect(stored).not.toContain(fixture.fullName);
    expect(stored).not.toContain(saved.input.document);
    expect(stored).not.toContain(clinical.chiefComplaint);
    const audit = await sql!.query(`SELECT * FROM audit_events WHERE entity_id=$1 OR entity_id=$2 ORDER BY id`, [saved.patientId, saved.triage.id]);
    expect(audit.rows.map(row => row.action)).toEqual(['REGISTER_PATIENT', 'RECORD_TRIAGE']);
    expect(audit.rows.every(row => row.actor_id === actors.ENFERMERO && row.request_ip === '127.0.0.1')).toBe(true);
    expect(JSON.stringify(audit.rows)).not.toMatch(/fullName|spo2|chiefComplaint|document_hmac|level/);
  });

  it('rechaza duplicados concurrentes y conserva un único paciente con su triaje', async () => {
    const document = `DEMO-${randomUUID().replace(/-/g, '')}`;
    const responses = await Promise.all([
      request('/patients', 'POST', 'ENFERMERO', { ...fixture, document }),
      request('/patients', 'POST', 'MEDICO', { ...fixture, document: ` ${document.toLowerCase()} ` }),
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    const patient = responses.find(r => r.status === 201)!.body;
    expect((await sql!.query('SELECT count(*)::integer AS n FROM triage_records WHERE patient_id=$1', [patient.patientId])).rows[0].n).toBe(1);
    expect(JSON.stringify(responses.find(r => r.status === 409)!.body)).not.toContain(document);
  });

  it('anexa triajes sin sobrescribir el historial y busca el más reciente', async () => {
    const saved = await register({ ...clinical, spo2: 84 });
    const appended = await request(`/patients/${saved.patientId}/triage`, 'POST', 'MEDICO', clinical);
    expect(appended.status).toBe(201);
    expect(appended.body.triage).toMatchObject({ level: null, requiresClinicalReview: true });
    const history = await sql!.query('SELECT level FROM triage_records WHERE patient_id=$1 ORDER BY created_at', [saved.patientId]);
    expect(history.rows.map(row => row.level)).toEqual(['I', null]);
    const found = await request('/patients/search', 'POST', 'ADMISIONES', { document: saved.input.document });
    expect(found.body).toMatchObject({ patientId: saved.patientId, triageStatus: 'PENDING_CLINICAL_REVIEW', latestTriage: { id: appended.body.triage.id } });
    const latest = await request(`/patients/${saved.patientId}/triage/latest`, 'GET', 'MEDICO');
    expect(latest.status).toBe(200);
    expect(latest.body).toMatchObject({ patientId: saved.patientId, clinical, triage: { id: appended.body.triage.id } });
    expect((await sql!.query("SELECT count(*)::integer AS n FROM audit_events WHERE action='READ_TRIAGE' AND entity_id=$1", [appended.body.triage.id])).rows[0].n).toBe(1);
  });

  it('búsqueda exacta normalizada, respuesta mínima y espera desde el último registro', async () => {
    const saved = await register({ ...clinical, eva: 8 });
    await sql!.query("UPDATE triage_records SET created_at=now()-interval '7 minutes' WHERE id=$1", [saved.triage.id]);
    const found = await request('/patients/search', 'POST', 'ADMISIONES', { document: ` ${saved.input.document.toLowerCase()} ` });
    expect(found.status).toBe(200);
    expect(found.headers.get('cache-control')).toBe('no-store');
    expect(found.body).toMatchObject({ patientId: saved.patientId, triageStatus: 'DEMO_CLASSIFIED',
      latestTriage: { level: 'II', maxWaitMinutes: 30, elapsedMinutes: 7 } });
    expect(Object.keys(found.body).sort()).toEqual(['createdAt', 'latestTriage', 'patientId', 'provisional', 'triageStatus']);
    expect(JSON.stringify(found.body)).not.toMatch(/document|fullName|chiefComplaint|ciphertext|hmac|spo2|glasgow/);
    const missing = await request('/patients/search', 'POST', 'ADMISIONES', { document: 'DEMO-REG' });
    expect(missing.status).toBe(404);
    const audit = await sql!.query("SELECT new_state FROM audit_events WHERE action='SEARCH_PATIENT' AND entity_id='unmatched'");
    expect(audit.rows).toContainEqual({ new_state: { matched: false } });
  });

  it.each(roles)('aplica permisos de %s a cada endpoint nuevo', async role => {
    const search = await request('/patients/search', 'POST', role, { document: fixture.document });
    expect(search.status).toBe(['ENFERMERO', 'MEDICO', 'ADMISIONES'].includes(role) ? 200 : 403);
    const read = await request(`/patients/${patientId}/triage/latest`, 'GET', role);
    expect(read.status).toBe(['ENFERMERO', 'MEDICO'].includes(role) ? 200 : 403);
    const add = await request(`/patients/${patientId}/triage`, 'POST', role, clinical);
    expect(add.status).toBe(['ENFERMERO', 'MEDICO'].includes(role) ? 201 : 403);
    const create = await request('/patients', 'POST', role, { ...fixture, document: `ROLE-${role}` });
    expect(create.status).toBe(['ENFERMERO', 'MEDICO'].includes(role) ? 201 : 403);
    if (search.status === 403) expect(JSON.stringify(search.body)).not.toMatch(/patientId|document|level|spo2/);
  });

  it.each([
    ['/patients', 'POST'], ['/patients/search', 'POST'],
    ['/patients/00000000-0000-4000-8000-000000000000/triage', 'POST'],
    ['/patients/00000000-0000-4000-8000-000000000000/triage/latest', 'GET'],
  ])('exige JWT antes de validar entrada en %s', async (path, method) => {
    expect((await request(path, method, undefined, method === 'POST' ? {} : undefined)).status).toBe(401);
  });

  it('rechaza JWT alterados, expirados o destinados a otra aplicación', async () => {
    const jwt = app!.get(JwtService);
    for (const token of ['alterado',
      await jwt.signAsync({ sub: actors.MEDICO, role: 'MEDICO' }, { expiresIn: -1 }),
      await jwt.signAsync({ sub: actors.MEDICO, role: 'MEDICO' }, { audience: 'another-app' }),
      await jwt.signAsync({ sub: actors.MEDICO, role: 'MEDICO' }, { issuer: 'another-issuer' }),
    ]) expect((await request('/patients/search', 'POST', undefined, { document: fixture.document }, token)).status).toBe(401);
  });

  it.each([
    { document: undefined }, { document: '' }, { document: 'aa' }, { document: 'a'.repeat(41) },
    { document: "' OR 1=1 --" }, { document: 123 }, { fullName: undefined }, { fullName: '' },
    { fullName: '  ' }, { fullName: 'a'.repeat(161) }, { fullName: 'Nombre\nPrivado' },
    { triage: undefined }, { triage: null }, { triage: [] }, { triage: {} }, { extra: 'dato privado' },
    ...[{ spo2: -1 }, { spo2: 101 }, { spo2: '84' }, { spo2: 84.1 }, { glasgow: 2 }, { glasgow: 16 },
      { eva: -1 }, { eva: 11 }, { paroInminente: 'false' }, { dolorToracicoTipico: null },
      { chiefComplaint: '' }, { chiefComplaint: '  ' }, { chiefComplaint: 'a'.repeat(1001) },
      { level: 'III' }, { requiresClinicalReview: false }].map(change => ({ triage: { ...clinical, ...change } })),
  ])('valida registro sin eco de datos: %j', async change => {
    const response = await request('/patients', 'POST', 'ENFERMERO', { ...fixture, ...change });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ statusCode: 400, message: 'Datos de entrada inválidos' });
  });

  it('valida búsqueda, UUID y triaje posterior', async () => {
    for (const body of [{}, { document: null }, { document: ['DEMO'] }, { document: fixture.document, limit: 100 }]) {
      expect((await request('/patients/search', 'POST', 'ADMISIONES', body)).status).toBe(400);
    }
    expect((await request(`/patients/invalid/triage`, 'POST', 'MEDICO', clinical)).status).toBe(400);
    expect((await request(`/patients/invalid/triage/latest`, 'GET', 'MEDICO')).status).toBe(400);
    expect((await request(`/patients/${patientId}/triage`, 'POST', 'MEDICO', { ...clinical, eva: 99 })).status).toBe(400);
    const missing = randomUUID();
    expect((await request(`/patients/${missing}/triage`, 'POST', 'MEDICO', clinical)).status).toBe(404);
    expect((await request(`/patients/${missing}/triage/latest`, 'GET', 'MEDICO')).status).toBe(404);
  });

  it('oculta datos en errores de JSON y rutas desconocidas anteriores al controlador', async () => {
    const response = await fetch(`${baseUrl}/api/patients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"private":"PERSONAL_SECRET" oops' });
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain('PERSONAL_SECRET');
    const unknown = await request('/patients/PRIVATE_DOCUMENT');
    expect(unknown.status).toBe(404);
    expect(JSON.stringify(unknown.body)).not.toContain('PRIVATE_DOCUMENT');
  });

  it('falla sin persistencia parcial ni respuesta clínica cuando falla la auditoría', async () => {
    const saved = await register();
    const before = await sql!.query(`SELECT (SELECT count(*) FROM patients) AS patients,
      (SELECT count(*) FROM triage_records) AS triages,(SELECT count(*) FROM audit_events) AS audits`);
    await sql!.query(`CREATE FUNCTION reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.action='REGISTER_PATIENT' THEN RETURN NEW; END IF;
        RAISE EXCEPTION 'SENSITIVE_SQL_DETAIL';
      END; $$;
      CREATE TRIGGER reject_test_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_test_audit();`);
    try {
      for (const [path, method, body] of [
        ['/patients', 'POST', { ...fixture, document: 'ROLLBACK-001' }],
        [`/patients/${saved.patientId}/triage`, 'POST', { ...clinical, spo2: 84 }],
        ['/patients/search', 'POST', { document: fixture.document }],
        [`/patients/${saved.patientId}/triage/latest`, 'GET', undefined],
      ] as const) {
        const response = await request(path, method, 'MEDICO', body);
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ statusCode: 500, message: 'No fue posible procesar la solicitud' });
      }
      expect((await sql!.query(`SELECT (SELECT count(*) FROM patients) AS patients,
        (SELECT count(*) FROM triage_records) AS triages,(SELECT count(*) FROM audit_events) AS audits`)).rows).toEqual(before.rows);
    } finally { await sql!.query('DROP TRIGGER reject_test_audit ON audit_events; DROP FUNCTION reject_test_audit();'); }
  });

  it('rechaza lectura de ciphertext alterado sin revelar contenido', async () => {
    const saved = await register();
    await sql!.query('UPDATE triage_records SET clinical_payload_ciphertext=$1 WHERE id=$2', [Buffer.from('corrupto'), saved.triage.id]);
    const read = await request(`/patients/${saved.patientId}/triage/latest`, 'GET', 'MEDICO');
    expect(read.status).toBe(500);
    expect(read.body).toEqual({ statusCode: 500, message: 'No fue posible procesar la solicitud' });
  });

  it('mantiene disponibles los endpoints previos sin claves de pacientes y falla cerrado en los nuevos', async () => {
    const key = process.env.PATIENT_DATA_KEY;
    delete process.env.PATIENT_DATA_KEY;
    try {
      expect((await request('/patients', 'POST', 'MEDICO', { ...fixture, document: 'NO-KEY-001' })).status).toBe(503);
      expect((await request('/patients/search', 'POST', 'ADMISIONES', { document: fixture.document })).status).toBe(503);
      expect((await request('/beds', 'GET', 'SERVICIOS')).body).toHaveLength(38);
      expect((await request('/triage/preview', 'POST', 'ENFERMERO', { ...clinical, chiefComplaint: undefined })).status).toBe(201);
    } finally { process.env.PATIENT_DATA_KEY = key; }
  });

  it('conserva funcional la limpieza auditada y el trigger de auditoría', async () => {
    await sql!.query("UPDATE beds SET status='CLEANING' WHERE code='UA-01'");
    const census = await request('/beds', 'GET', 'SERVICIOS');
    const version = census.body.find((bed: { code: string }) => bed.code === 'UA-01').updated_at;
    const response = await request('/beds/UA-01/complete-cleaning', 'POST', 'SERVICIOS', { expectedUpdatedAt: version });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ code: 'UA-01', status: 'AVAILABLE' });
    expect((await request('/beds/UA-01/complete-cleaning', 'POST', 'MEDICO')).status).toBe(403);
    await expect(sql!.query('UPDATE audit_events SET action=action')).rejects.toThrow('solo anexado');
    expect((await request('/beds', 'GET', 'SERVICIOS')).body).toHaveLength(38);
  });
});
