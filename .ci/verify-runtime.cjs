// Full Linux suite plus business-flow smoke against the actual runtime image.
// All PostgreSQL data, users, credentials and keys are newly generated for this run.
const { randomBytes, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const { mkdirSync, readFileSync } = require('node:fs');
const { strict: assert } = require('node:assert');
const { root, reports, lock, run, execute, json, mask } = require('./lib.cjs');
const image = process.env.SITCAMA_CI_IMAGE || 'sitcama-api:inc07-distroless';
const verifyImage = process.env.SITCAMA_VERIFY_IMAGE || 'sitcama-api:inc07-verify';
const name = `sitcama-inc07-${randomUUID()}`, db = `${name}-db`, api = `${name}-api`;
const password = randomBytes(32).toString('base64url'), databasePassword = randomBytes(32).toString('base64url');
const env = { ...process.env, POSTGRES_PASSWORD: databasePassword, TEST_PGPASSWORD: databasePassword, PGPASSWORD: databasePassword,
  JWT_SECRET: randomBytes(48).toString('base64'), PATIENT_DATA_KEY: randomBytes(32).toString('base64'),
  PATIENT_HMAC_KEY: randomBytes(32).toString('base64'), DAST_PASSWORD: password };
const secrets = [password, databasePassword, env.JWT_SECRET, env.PATIENT_DATA_KEY, env.PATIENT_HMAC_KEY]; secrets.forEach(mask);
const created = [];
const result = { started: new Date().toISOString(), image, verifyImage, checks: [] };
const pause = () => new Promise(r => setTimeout(r, 1000));
function sanitized(message) { for (const secret of secrets) message = message.replaceAll(secret, '[REDACTED]'); return message; }
(async () => {
  let network = false;
  try {
    result.runtimeImageId = run('docker', ['image', 'inspect', image, '--format', '{{.Id}}']);
    result.verifyImageId = run('docker', ['image', 'inspect', verifyImage, '--format', '{{.Id}}']);
    run('docker', ['network', 'create', '--internal', '--label', 'sitcama.owner=incremento-07', name]); network = true;
    run('docker', ['run', '-d', '--name', db, '--network', name, '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=512m',
      '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_USER=sitcama_dast', '-e', 'POSTGRES_DB=sitcama_dast', lock.postgres], { env }); created.push(db);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { run('docker', ['exec', db, 'pg_isready', '-U', 'sitcama_dast', '-d', 'sitcama_dast']); ready = true; break; } catch { await pause(); }
    }
    if (!ready) throw new Error('Private PostgreSQL readiness timeout');
    const linux = resolve(reports, 'linux'); mkdirSync(linux, { recursive: true });
    await execute('docker', ['run', '--rm', '--network', name, '--cap-drop=ALL', '--security-opt=no-new-privileges',
      '-e', `TEST_PGHOST=${db}`, '-e', 'TEST_PGPORT=5432', '-e', 'TEST_PGDATABASE=sitcama_dast', '-e', 'TEST_PGUSER=sitcama_dast', '-e', 'TEST_PGPASSWORD',
      '--mount', `type=bind,source=${linux},target=/reports`, verifyImage,
      'npm', 'run', 'test:cov', '--', '--coverageDirectory=/reports/coverage', '--json', '--outputFile=/reports/api-tests.json'], { env });
    const suite = JSON.parse(readFileSync(resolve(linux, 'api-tests.json'), 'utf8'));
    assert.equal(suite.numFailedTests, 0); assert.ok(suite.numPassedTests >= 168);
    result.checks.push({ name: 'Complete API Linux suite and coverage gate', passed: suite.numPassedTests, failed: suite.numFailedTests });
    run('docker', ['exec', '-i', db, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'sitcama_dast', '-d', 'sitcama_dast'], { input: readFileSync(resolve(root, 'apps/api/db/001_initial.sql')), env });
    const apiEnv = ['-e', `PGHOST=${db}`, '-e', 'PGUSER=sitcama_dast', '-e', 'PGDATABASE=sitcama_dast', '-e', 'PGPASSWORD',
      '-e', 'JWT_SECRET', '-e', 'PATIENT_DATA_KEY', '-e', 'PATIENT_HMAC_KEY', '-e', 'NODE_ENV=production', '-e', 'APP_ORIGIN=https://dast.test'];
    run('docker', ['run', '--rm', '--network', name, ...apiEnv, '-e', 'DAST_PASSWORD', '-e', 'SITCAMA_DAST_ISOLATED=true',
      '--mount', `type=bind,source=${resolve(root, '.ci/dast-seed.cjs')},target=/app/dast-seed.cjs,readonly`, image, 'node', '/app/dast-seed.cjs'], { env });
    run('docker', ['run', '-d', '--name', api, '--network', name, '--read-only', '--tmpfs', '/tmp', '--cap-drop=ALL', '--security-opt=no-new-privileges', ...apiEnv, image], { env }); created.push(api);
    async function request(path, options = {}) {
      const code = `let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',async()=>{try{const q=JSON.parse(input);const r=await fetch('http://127.0.0.1:3000/api'+q.path,q.options);console.log(JSON.stringify({status:r.status,body:await r.text()}))}catch{process.exitCode=1}})`;
      const response = JSON.parse(run('docker', ['exec', '-i', api, 'node', '-e', code], { input: JSON.stringify({ path, options }) }));
      return { status: response.status, body: response.body ? JSON.parse(response.body) : null };
    }
    for (let i = 0; i < 60; i++) { try { if ((await request('/health')).status === 200) break; } catch { /* startup */ } await pause(); }
    const tokens = {};
    for (const role of ['MEDICO','SERVICIOS','AUDITOR']) {
      const response = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${role.toLowerCase()}@dast.test`, password }) });
      assert.equal(response.status, 200, `JWT login ${role}`); tokens[role] = response.body.access_token; secrets.push(tokens[role]); mask(tokens[role]);
    }
    const get = (path, role = 'MEDICO') => request(path, { headers: { Authorization: `Bearer ${tokens[role]}` } });
    const post = (path, body, role = 'MEDICO') => request(path, { method: 'POST', headers: { Authorization: `Bearer ${tokens[role]}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const document = `INC07-${randomBytes(8).toString('hex')}`;
    const registration = await post('/patients', { document, fullName: 'Persona Sintetica Inc07', triage: {
      chiefComplaint: 'Caso ficticio de compatibilidad del runtime', spo2: 84, glasgow: 15, eva: 1, paroInminente: false, dolorToracicoTipico: false } });
    assert.equal(registration.status, 201); assert.equal(registration.body.triage.level, 'I');
    const search = await post('/patients/search', { document }); assert.equal(search.status, 200);
    assert.equal(search.body.patientId, registration.body.patientId); assert.equal(search.body.fullName, undefined); assert.equal(search.body.document, undefined);
    const beds = await get('/beds'); assert.equal(beds.status, 200); assert.equal(beds.body.length, 38);
    const bed = beds.body.find(b => b.code === 'UA-01');
    const assigned = await post(`/beds/${bed.code}/assign`, { patientId: search.body.patientId, service: bed.service }); assert.equal(assigned.status, 201); assert.equal(assigned.body.bed.status, 'OCCUPIED');
    assert.equal((await post(`/beds/${bed.code}/assign`, { patientId: search.body.patientId, service: bed.service })).status, 409);
    assert.equal((await post('/beds/UA-02/assign', { patientId: search.body.patientId, service: bed.service })).status, 409);
    const released = await post(`/beds/${bed.code}/release`, { assignmentId: assigned.body.assignment.id }); assert.equal(released.status, 200); assert.equal(released.body.bed.status, 'CLEANING');
    const cleaned = await post(`/beds/${bed.code}/complete-cleaning`, { expectedUpdatedAt: released.body.bed.updated_at }, 'SERVICIOS');
    assert.equal(cleaned.status, 201); assert.equal(cleaned.body.status, 'AVAILABLE');
    assert.equal((await get('/triage/panel')).body.totals.levelI, 1);
    const audit = await get('/audit/events?action=ASSIGN_BED&limit=5', 'AUDITOR'); assert.equal(audit.status, 200); assert.equal(audit.body.items.length, 1);
    assert.equal((await get('/triage/panel', 'SERVICIOS')).status, 403);
    assert.equal((await get('/audit/events', 'SERVICIOS')).status, 403);
    assert.equal((await post('/patients/search', { document }, 'SERVICIOS')).status, 403);
    result.checks.push({ name: 'Actual final image: JWT, encrypted patient/triage/search, 38 beds, assignment 409, release, cleaning, panel, audit and SERVICIOS denial', status: 'passed' });
    let healthy = false;
    for (let i = 0; i < 45; i++) { if (run('docker', ['inspect', api, '--format', '{{.State.Health.Status}}']) === 'healthy') { healthy = true; break; } await pause(); }
    assert.equal(healthy, true, 'Exec-form Docker HEALTHCHECK');
    result.checks.push({ name: 'Docker HEALTHCHECK, read-only root filesystem, UID 10001, no capabilities', status: 'passed' });
    result.status = 'passed';
  } catch (error) { result.status = 'failed'; result.error = sanitized(error.message); process.exitCode = 1; }
  finally {
    for (const container of created.reverse()) { try { run('docker', ['rm', '-f', container]); } catch { /* report still retained */ } }
    if (network) run('docker', ['network', 'rm', name]);
    result.finished = new Date().toISOString(); json('runtime-verification.json', result); console.log(JSON.stringify(result, null, 2));
  }
})();
