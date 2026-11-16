import 'reflect-metadata';
import { io, Socket } from 'socket.io-client';
import { RealtimeGateway } from '../src/realtime/realtime.gateway';
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
describe('HU-02/HU-08 HTTP y Socket.IO con PostgreSQL', () => {
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
  const clients: Socket[] = [];

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
      clients.forEach(client => client.disconnect());
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

  function socket(token: unknown = tokens.MEDICO, origin?: string) {
    const client = io(`${baseUrl}/triage`, { transports: ['websocket'], forceNew: true,
      reconnection: false, autoConnect: false, auth: { token },
      ...(origin ? { extraHeaders: { Origin: origin } } : {}) });
    clients.push(client); return client;
  }
  function event<T = any>(client: Socket, name: string, ms = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { client.off(name, receive); reject(new Error(`Evento esperado: ${name}`)); }, ms);
      function receive(value: T) { clearTimeout(timer); resolve(value); }
      client.once(name, receive);
    });
  }
  async function connected(token = tokens.MEDICO) {
    const client = socket(token); const ready = event(client, 'connect'); client.connect(); await ready; return client;
  }

  it('exige JWT y roles exactos en ambas consultas; SERVICIOS no consulta clínica', async () => {
    for (const path of ['/triage/panel', '/audit/events']) {
      expect((await request(path)).status).toBe(401);
      for (const role of roles) expect((await request(path, 'GET', role)).status)
        .toBe(role === (path.includes('audit') ? 'AUDITOR' : 'MEDICO') ? 200 : 403);
    }
    expect((await request(`/patients/${patientId}/triage/latest`, 'GET', 'SERVICIOS')).status).toBe(403);
    await sql!.query('UPDATE users SET active=false WHERE id=$1', [actors.MEDICO]);
    expect((await request('/triage/panel', 'GET', 'MEDICO')).status).toBe(403);
    await sql!.query('UPDATE users SET active=true WHERE id=$1', [actors.MEDICO]);
    await sql!.query('UPDATE users SET role=$2 WHERE id=$1', [actors.AUDITOR, 'SERVICIOS']);
    expect((await request('/audit/events', 'GET', 'AUDITOR')).status).toBe(403);
    await sql!.query('UPDATE users SET role=$2 WHERE id=$1', [actors.AUDITOR, 'AUDITOR']);
  });

  it('ordena I/II/pendientes, usa último triaje, pagina y omite identidad y signos', async () => {
    const one = await register({ ...clinical, spo2: 84 });
    const two = await register({ ...clinical, eva: 8 });
    const pending = await register();
    await request(`/patients/${one.patientId}/triage`, 'POST', 'MEDICO', { ...clinical, eva: 8 });
    const critical = await register({ ...clinical, spo2: 84 });
    await sql!.query(`UPDATE triage_records SET created_at=CURRENT_TIMESTAMP-INTERVAL '25 hours' WHERE patient_id=$1`, [two.patientId]);
    // A legacy III value is never offered as an implemented classification.
    await sql!.query(`UPDATE triage_records SET level='III',requires_clinical_review=false WHERE patient_id=$1`, [pending.patientId]);
    const response = await request('/triage/panel?limit=100', 'GET', 'MEDICO');
    expect(response.status).toBe(200);
    expect(response.body.items[0]).toMatchObject({ patientId: critical.patientId, level: 'I', demoOnly: true });
    expect(response.body.items.filter((row: any) => row.patientId === one.patientId)).toHaveLength(1);
    expect(response.body.items.find((row: any) => row.patientId === one.patientId).level).toBe('II');
    expect(response.body.items.find((row: any) => row.patientId === pending.patientId)).toMatchObject({ level: null, requiresClinicalReview: true, maxWaitMinutes: null });
    expect(response.body.items.some((row: any) => row.patientId === two.patientId)).toBe(false);
    expect(response.body.totals.total).toBe(response.body.items.length);
    expect(JSON.stringify(response.body)).not.toMatch(/chiefComplaint|spo2|ciphertext|Persona|DEMO-|III/);
    const first = await request('/triage/panel?limit=1', 'GET', 'MEDICO');
    const second = await request('/triage/panel?limit=1&page=2', 'GET', 'MEDICO');
    expect(first.body.items[0].patientId).not.toBe(second.body.items[0].patientId);
    expect((await request('/triage/panel?page=1000', 'GET', 'MEDICO')).body.items).toEqual([]);
  });

  it.each(['page=0','page=1.5','limit=101','page=x','level=III'])('valida panel %s', async query => {
    expect((await request(`/triage/panel?${query}`, 'GET', 'MEDICO')).status).toBe(400);
  });
  it.each(['limit=0','limit=101','cursor=0','cursor=-1','cursor=9223372036854775808','from=abc',
    'from=2026-02-30','from=2026-11-15T00:00:00Z&to=2026-11-14T00:00:00Z','actorId=no',
    'action=DELETE','entityType=clinical','unknown=true'])('valida auditoría %s', async query => {
    expect((await request(`/audit/events?${query}`, 'GET', 'AUDITOR')).status).toBe(400);
  });

  it('auditoría filtra, pagina bigint sin duplicados y redacta datos fuera de catálogo', async () => {
    const marker = randomUUID();
    await sql!.query(`INSERT INTO audit_events(actor_id,entity_type,entity_id,action,new_state,request_ip)
      VALUES($1,'patient',$2,'SEARCH_PATIENT',$3::jsonb,'198.51.100.1')`, [actors.MEDICO, marker, JSON.stringify({ sensitive: 'SENTINEL_PRIVADO' })]);
    await sql!.query(`INSERT INTO audit_events(actor_id,entity_type,entity_id,action) VALUES
      ($1,'panel','triage','READ_TRIAGE_PANEL'),($1,'audit','events','READ_AUDIT'),
      ($1,'bed','URG-01','ASSIGN_BED'),($1,'patient','unmatched','SEARCH_PATIENT'),
      ($1,'triage',$2,'READ_TRIAGE'),($1,'patient','IDENTIDAD_PRIVADA','ACCION_PRIVADA'),
      ($1,'TIPO_PRIVADO','SECRETO_PRIVADO','ACCION_PRIVADA')`, [actors.MEDICO, randomUUID()]);
    const result = await request(`/audit/events?actorId=${actors.MEDICO}&action=SEARCH_PATIENT&entityType=patient&from=2000-01-01T00:00:00Z&to=2099-01-01T00:00:00Z&limit=1`, 'GET', 'AUDITOR');
    expect(result.status).toBe(200); expect(typeof result.body.items[0].id).toBe('string');
    expect(result.body.nextCursor).toBe(result.body.items[0].id);
    const second = await request(`/audit/events?actorId=${actors.MEDICO}&action=SEARCH_PATIENT&entityType=patient&cursor=${result.body.nextCursor}&limit=1`, 'GET', 'AUDITOR');
    expect(second.body.items[0].entityId).toBe(marker); expect(second.body.nextCursor).toBeNull();
    expect(BigInt(second.body.items[0].id)).toBeLessThan(BigInt(result.body.items[0].id));
    const all = await request('/audit/events?limit=100', 'GET', 'AUDITOR');
    expect(all.headers.get('cache-control')).toBe('no-store');
    expect(JSON.stringify(all.body)).not.toMatch(/SENTINEL|sensitive|198\.51|IDENTIDAD_PRIVADA|TIPO_PRIVADO|SECRETO_PRIVADO|ACCION_PRIVADA|new_state|password|ciphertext/);
    expect(all.body.items.some((row: any) => row.action === 'REDACTED')).toBe(true);
    expect((await sql!.query(`SELECT actor_id FROM audit_events WHERE action='READ_AUDIT' ORDER BY id DESC LIMIT 1`)).rows[0].actor_id).toBe(actors.AUDITOR);
    expect((await request('/audit/events?cursor=9223372036854775807&action=COMPLETE_CLEANING', 'GET', 'AUDITOR')).body.items).toEqual([]);
    for (const method of ['POST','PATCH','DELETE']) expect((await request('/audit/events', method, 'AUDITOR', {})).status).toBe(404);
    await expect(sql!.query(`DELETE FROM audit_events WHERE entity_id=$1`, [marker])).rejects.toThrow();
    await expect(sql!.query(`UPDATE audit_events SET action='changed' WHERE entity_id=$1`, [marker])).rejects.toThrow();
  });

  it('ordena y pagina IDs bigint entre cantidades de dígitos sin duplicados ni omisiones', async () => {
    // Explicit IDs affect only this suite's fresh schema, never public data or its sequence.
    const ids = ['9999', '10000', '99999', '100000', '9007199254740992', '9007199254740993',
      '9223372036854775806', '9223372036854775807'];
    for (const id of ids) {
      await sql!.query(`INSERT INTO audit_events(id,actor_id,entity_type,entity_id,action)
        VALUES($1,$2,'bed','UA-01','READ_BED_ASSIGNMENT')`, [id, actors.COORDINADOR]);
    }
    const expected = [...ids].reverse();
    for (const limit of [1, 3, 100]) {
      const received: string[] = [];
      let cursor: string | null = null;
      do {
        const response = await request(`/audit/events?actorId=${actors.COORDINADOR}&action=READ_BED_ASSIGNMENT&entityType=bed&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`, 'GET', 'AUDITOR');
        expect(response.status).toBe(200);
        const pageIds = response.body.items.map((item: { id: string }) => item.id);
        expect(pageIds.every((id: unknown) => typeof id === 'string')).toBe(true);
        expect(pageIds).toEqual(expected.slice(received.length, received.length + limit));
        received.push(...pageIds);
        cursor = response.body.nextCursor;
        expect(cursor).toBe(received.length < expected.length ? received.at(-1) : null);
        // Bound traversal even if an incorrect cursor repeats a nonempty page forever.
        expect(received.length).toBeLessThanOrEqual(expected.length);
      } while (cursor !== null);
      expect(received).toEqual(expected);
      expect(new Set(received).size).toBe(ids.length);
    }
  });

  it.each([undefined, 'bad', 'SERVICIOS', 'AUDITOR', 'ENFERMERO', 'ADMISIONES', 'COORDINADOR'])('rechaza handshake no autorizado %s', async value => {
    const token = value && roles.includes(value as Role) ? tokens[value as Role] : value ?? null;
    const client = socket(token); const failed = event(client, 'connect_error'); client.connect();
    expect((await failed).message).toBe('Acceso denegado'); expect(client.connected).toBe(false);
    client.disconnect();
  });
  it('bloquea origen ajeno y token en query; admite origen de desarrollo', async () => {
    const rejected = socket(tokens.MEDICO, 'https://evil.invalid');
    const failure = event(rejected, 'connect_error'); rejected.connect(); await failure; rejected.disconnect();
    const allowed = socket(tokens.MEDICO, 'http://localhost:8100');
    const ready = event(allowed, 'connect'); allowed.connect(); await ready;
    const ack = await allowed.timeout(3000).emitWithAck('triage:sync', {}); expect(ack).toEqual({ ok: true }); allowed.disconnect();
    const client = socket(null); client.io.opts.query = { token: tokens.MEDICO };
    const denied = event(client, 'connect_error'); client.connect(); await denied; client.disconnect();
  });

  it('publica únicamente tras COMMIT, sin información del paciente; fallo de aviso no revierte registro', async () => {
    const client = await connected(); const received = event(client, 'triage:changed');
    const saved = await register({ ...clinical, spo2: 84 });
    const notice = await received;
    expect(Object.keys(notice).sort()).toEqual(['criticalDemo','eventId']);
    expect(notice.criticalDemo).toBe(true);
    expect((await sql!.query('SELECT id FROM patients WHERE id=$1', [saved.patientId])).rows).toHaveLength(1);
    const spy = jest.spyOn(app!.get(RealtimeGateway), 'notify').mockRejectedValueOnce(new Error('offline'));
    const persisted = await register();
    expect((await sql!.query('SELECT id FROM patients WHERE id=$1', [persisted.patientId])).rows).toHaveLength(1);
    spy.mockRestore();
    const listener = jest.fn(); client.on('triage:changed', listener);
    const duplicate = await request('/patients', 'POST', 'ENFERMERO', saved.input);
    expect(duplicate.status).toBe(409);
    await new Promise(resolve => setTimeout(resolve, 100)); expect(listener).not.toHaveBeenCalled();
    const updated = event(client, 'triage:changed');
    expect((await request(`/patients/${saved.patientId}/triage`, 'POST', 'MEDICO', clinical)).status).toBe(201);
    expect((await updated).criticalDemo).toBe(false); client.disconnect();
  });

  it.each([['triage:changed', {}], ['triage:sync', { role: 'MEDICO' }], ['triage:sync', []], ['other', {}]])('rechaza evento cliente %s', async (name, body) => {
    const client = await connected(); const ended = event(client, 'disconnect'); client.emit(name as string, body); await ended;
    expect(client.connected).toBe(false);
  });
  it('un fallo de auditoría revierte escrituras, impide avisos y no devuelve lecturas', async () => {
    const client = await connected(); const notices = jest.fn(); client.on('triage:changed', notices);
    const before = (await sql!.query('SELECT count(*)::int AS total FROM patients')).rows[0].total;
    await sql!.query(`CREATE FUNCTION fail_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action IN ('RECORD_TRIAGE','READ_TRIAGE_PANEL','READ_AUDIT') THEN
        RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_test_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_test_audit();`);
    try {
      const failed = await request('/patients', 'POST', 'ENFERMERO', { ...fixture, document: `DEMO-${randomUUID().replaceAll('-', '')}` });
      expect(failed.status).toBe(500);
      expect((await sql!.query('SELECT count(*)::int AS total FROM patients')).rows[0].total).toBe(before);
      for (const [path, role] of [['/triage/panel','MEDICO'],['/audit/events','AUDITOR']] as const) {
        const response = await request(path, 'GET', role); expect(response.status).toBe(500);
        expect(JSON.stringify(response.body)).not.toMatch(/items|patientId|synthetic audit/);
      }
      await new Promise(resolve => setTimeout(resolve, 100)); expect(notices).not.toHaveBeenCalled();
    } finally {
      await sql!.query('DROP TRIGGER fail_test_audit ON audit_events; DROP FUNCTION fail_test_audit()');
      client.disconnect();
    }
  });
  it('revalida rol activo por evento y por entrega; desconecta al vencer JWT', async () => {
    let client = await connected();
    let ended = event(client, 'disconnect');
    await sql!.query('UPDATE users SET active=false WHERE id=$1', [actors.MEDICO]);
    client.emit('triage:sync', {}); await ended;
    await sql!.query('UPDATE users SET active=true WHERE id=$1', [actors.MEDICO]);
    client = await connected(); ended = event(client, 'disconnect');
    const notices = jest.fn(); client.on('triage:changed', notices);
    await sql!.query('UPDATE users SET role=$2 WHERE id=$1', [actors.MEDICO, 'SERVICIOS']);
    await register(); await ended; expect(notices).not.toHaveBeenCalled();
    await sql!.query('UPDATE users SET role=$2 WHERE id=$1', [actors.MEDICO, 'MEDICO']);
    const jwt = app!.get(JwtService);
    const expired = await jwt.signAsync({ sub: actors.MEDICO, role: 'MEDICO' }, { expiresIn: -1 });
    const invalid = socket(expired); const denied = event(invalid, 'connect_error'); invalid.connect(); await denied; invalid.disconnect();
    const short = await jwt.signAsync({ sub: actors.MEDICO, role: 'MEDICO' }, { expiresIn: 2 });
    client = await connected(short); await event(client, 'disconnect');
  });
});

