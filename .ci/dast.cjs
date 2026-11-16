// Active scanning is physically confined to a new internal Docker network.
// No .env, existing container, public patient or named volume is used.
const { randomBytes, randomUUID } = require('node:crypto');
const { mkdirSync, writeFileSync, readFileSync, existsSync } = require('node:fs');
const { resolve, sep } = require('node:path');
const { root, reports, lock, run, execute, json, mask } = require('./lib.cjs');
const name = `sitcama-dast-${randomUUID()}`;
const db = `${name}-db`, api = `${name}-api`;
const image = process.env.SITCAMA_CI_IMAGE || 'sitcama-api:devsecops';
const password = randomBytes(32).toString('base64url');
const dbPassword = randomBytes(32).toString('base64url');
const env = { ...process.env, POSTGRES_PASSWORD: dbPassword, PGPASSWORD: dbPassword,
  JWT_SECRET: randomBytes(48).toString('base64'), PATIENT_DATA_KEY: randomBytes(32).toString('base64'),
  PATIENT_HMAC_KEY: randomBytes(32).toString('base64'), DAST_PASSWORD: password };
const secrets = [password, dbPassword, env.JWT_SECRET, env.PATIENT_DATA_KEY, env.PATIENT_HMAC_KEY];
secrets.forEach(mask);
const work = resolve(root, '.cache/devsecops', name);
mkdirSync(work, { recursive: true });
const created = [];
const result = { started: new Date().toISOString(), isolatedNetwork: name, probes: [], scans: [] };
function sanitize(value) {
  let clean = value;
  for (const secret of secrets) clean = clean.replaceAll(secret, '[REDACTED]');
  return clean.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
}
function operation(method, path, body) {
  return [path, { [method.toLowerCase()]: { operationId: `${method}_${path.replace(/\W/g, '_')}`, responses: { 200: { description: 'API response' } },
    ...(body ? { requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: Object.fromEntries(Object.entries(body).map(([k,v]) => [k, { type: typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'integer' : 'string', example: v }])) } } } } } : {}) } }];
}
async function main() {
  let network = false;
  try {
    run('docker', ['network', 'create', '--internal', '--label', 'sitcama.owner=devsecops-dast', name]); network = true;
    run('docker', ['run', '-d', '--name', db, '--network', name, '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=512m',
      '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_USER=sitcama_dast', '-e', 'POSTGRES_DB=sitcama_dast', lock.postgres], { env }); created.push(db);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { run('docker', ['exec', db, 'pg_isready', '-U', 'sitcama_dast', '-d', 'sitcama_dast']); ready = true; break; }
      catch { await new Promise(r => setTimeout(r, 1000)); }
    }
    if (!ready) throw new Error('PostgreSQL readiness timeout');
    run('docker', ['exec', '-i', db, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'sitcama_dast', '-d', 'sitcama_dast'], { input: readFileSync(resolve(root, 'apps/api/db/001_initial.sql')), env });
    const apiEnv = ['-e', `PGHOST=${db}`, '-e', 'PGUSER=sitcama_dast', '-e', 'PGDATABASE=sitcama_dast', '-e', 'PGPASSWORD',
      '-e', 'JWT_SECRET', '-e', 'PATIENT_DATA_KEY', '-e', 'PATIENT_HMAC_KEY', '-e', 'NODE_ENV=production', '-e', 'APP_ORIGIN=https://dast.test'];
    run('docker', ['run', '--rm', '--network', name, ...apiEnv, '-e', 'DAST_PASSWORD', '-e', 'SITCAMA_DAST_ISOLATED=true',
      '--mount', `type=bind,source=${resolve(root, '.ci/dast-seed.cjs')},target=/app/dast-seed.cjs,readonly`, image, 'node', '/app/dast-seed.cjs'], { env });
    run('docker', ['run', '-d', '--name', api, '--network', name, '--read-only', '--tmpfs', '/tmp', '--cap-drop=ALL', '--security-opt=no-new-privileges',
      ...apiEnv, image], { env }); created.push(api);
    // Probe from inside the API container: the internal network publishes NO ports.
    const request = async (path, options = {}) => {
      const code = `let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',async()=>{try{const q=JSON.parse(input);const r=await fetch('http://127.0.0.1:3000/api'+q.path,q.options);console.log(JSON.stringify({status:r.status,body:await r.text()}))}catch{process.exitCode=1}})`;
      const response = JSON.parse(run('docker', ['exec', '-i', api, 'node', '-e', code], { input: JSON.stringify({ path, options }) }));
      return { status: response.status, ok: response.status >= 200 && response.status < 300, json: async () => JSON.parse(response.body) };
    };
    for (let i = 0; i < 60; i++) {
      try { if ((await request('/health')).ok) { ready = true; break; } } catch { /* startup */ }
      ready = false; await new Promise(r => setTimeout(r, 1000));
    }
    if (!ready) throw new Error('API readiness timeout');
    const tokens = {};
    for (const role of ['MEDICO', 'AUDITOR', 'SERVICIOS']) {
      const login = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${role.toLowerCase()}@dast.test`, password }) });
      if (!login.ok) throw new Error('DAST authentication failed');
      tokens[role] = (await login.json()).access_token; secrets.push(tokens[role]); mask(tokens[role]);
    }
    for (const [role, path, expected] of [['MEDICO','/triage/panel',200],['AUDITOR','/audit/events',200],['SERVICIOS','/triage/panel',403],['SERVICIOS','/audit/events',403]]) {
      const response = await request(path, { headers: { Authorization: `Bearer ${tokens[role]}` } });
      result.probes.push({ role, path, expected, actual: response.status });
      if (response.status !== expected) throw new Error('DAST authentication/RBAC probe failed');
    }
    const anonymous = await request('/beds');
    result.probes.push({ role: 'anonymous', path: '/beds', expected: 401, actual: anonymous.status });
    if (anonymous.status !== 401) throw new Error('Anonymous access regression');
    for (const role of ['MEDICO', 'AUDITOR']) {
      const action = role === 'MEDICO' ? 'READ_TRIAGE_PANEL' : 'READ_AUDIT';
      const auditedReads = () => Number(run('docker', ['exec', db, 'psql', '-tAc', `SELECT count(*) FROM audit_events WHERE action='${action}'`, '-U', 'sitcama_dast', '-d', 'sitcama_dast']));
      const before = auditedReads();
      const operations = role === 'MEDICO' ? [operation('GET', '/api/health'), operation('GET', '/api/beds'), operation('GET', '/api/triage/panel'),
        operation('POST', '/api/patients/search', { document: 'DAST-FICTICIO-001' }),
        operation('POST', '/api/triage/preview', { spo2: 98, glasgow: 15, eva: 1, paroInminente: false, dolorToracicoTipico: false })]
        : [operation('GET', '/api/audit/events')];
      const paths = Object.fromEntries(operations);
      if (role === 'MEDICO') paths['/api/triage/panel'].get.parameters = [{ in: 'query', name: 'page', schema: { type: 'integer', default: 1 } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 25 } }];
      if (role === 'AUDITOR') paths['/api/audit/events'].get.parameters = [{ in: 'query', name: 'action', schema: { type: 'string', default: 'READ_AUDIT' } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 25 } }];
      writeFileSync(resolve(work, 'openapi.json'), JSON.stringify({ openapi: '3.0.3', info: { title: 'SIT-CAMA isolated DAST contract subset', version: '1' }, servers: [{ url: `http://${api}:3000` }], paths }));
      const scanName = `${name}-${role.toLowerCase()}`;
      created.push(scanName);
      const scanEnv = { ...env, ZAP_AUTH_HEADER: 'Authorization', ZAP_AUTH_HEADER_VALUE: `Bearer ${tokens[role]}`, ZAP_AUTH_HEADER_SITE: api };
      let exit = 0;
      try {
        await execute('docker', ['run', '--rm', '--name', scanName, '--network', name, '-u', '0',
          '-e', 'ZAP_AUTH_HEADER', '-e', 'ZAP_AUTH_HEADER_VALUE', '-e', 'ZAP_AUTH_HEADER_SITE',
          '--mount', `type=bind,source=${work},target=/zap/wrk`, lock.zap,
          'zap-api-scan.py', '-t', '/zap/wrk/openapi.json', '-f', 'openapi', '-I', '-r', `${role}.html`, '-J', `${role}.json`,
          '-z', '-config scanner.threadPerHost=2 -config scanner.maxRuleDurationInMins=1 -config scanner.maxScanDurationInMins=5'], { env: scanEnv });
      } catch { exit = 1; }
      if (!existsSync(resolve(work, `${role}.json`))) throw new Error(`ZAP ${role} did not produce its report`);
      const report = JSON.parse(readFileSync(resolve(work, `${role}.json`), 'utf8'));
      if (!report.site?.length) throw new Error('ZAP report has no scanned site');
      const alerts = report.site.flatMap(site => site.alerts || []);
      const blocking = alerts.filter(a => Number(a.riskcode) >= 2);
      for (const extension of ['json', 'html']) writeFileSync(resolve(reports, `zap-${role.toLowerCase()}.${extension}`), sanitize(readFileSync(resolve(work, `${role}.${extension}`), 'utf8')));
      const authenticatedReads = auditedReads() - before;
      result.scans.push({ role, endpoints: Object.keys(paths), authenticatedReads, alerts: alerts.length, blocking: blocking.map(a => ({ id: a.pluginid, name: a.name, risk: a.riskdesc })), scannerNonzero: !!exit });
      if (authenticatedReads < 1) throw new Error(`ZAP ${role} did not reach an authenticated handler`);
      if (exit !== 0) throw new Error(`ZAP ${role} scanner execution failed; review the retained report`);
    }
    if (result.scans.some(s => s.blocking.length)) throw new Error('ZAP HIGH/MEDIUM findings block delivery');
    result.status = 'passed';
  } catch (error) { result.status = 'failed'; result.error = sanitize(error.message); process.exitCode = 1; }
  finally {
    for (const container of created.reverse()) { try { run('docker', ['rm', '-f', container]); } catch { /* --rm already removed scanner */ } }
    if (network) run('docker', ['network', 'rm', name]);
    // Delete only the exact random workspace directory; it contains ephemeral auth reports.
    if (!work.startsWith(resolve(root, '.cache/devsecops') + sep)) throw new Error('Unsafe DAST cleanup path');
    require('node:fs').rmSync(work, { recursive: true, force: true });
    result.finished = new Date().toISOString(); json('dast.json', result); console.log(JSON.stringify(result, null, 2));
  }
}
main();
