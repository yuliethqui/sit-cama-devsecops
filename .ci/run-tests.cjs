// Disposable PostgreSQL only. Never reads .env or attaches the existing pgdata volume.
const { randomBytes, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const { root, run, execute, json, mask, lock } = require('./lib.cjs');
const password = randomBytes(32).toString('base64url');
mask(password);
const name = `sitcama-ci-tests-${randomUUID()}`;
const started = new Date().toISOString();
const results = [];
let container;
async function step(name, command, args, cwd, env) {
  const start = Date.now();
  try {
    await execute(command, args, { cwd: resolve(root, cwd), env });
    results.push({ name, status: 'passed', seconds: (Date.now() - start) / 1000 });
  } catch (error) { results.push({ name, status: 'failed', error: error.message }); }
}
(async () => {
  try {
    container = run('docker', ['run', '-d', '--name', name, '--label', 'sitcama.owner=devsecops-tests',
      '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=512m',
      '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_USER=sitcama_ci',
      '-e', 'POSTGRES_DB=sitcama_ci', lock.postgres], { env: { ...process.env, POSTGRES_PASSWORD: password } });
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { run('docker', ['exec', container, 'pg_isready', '-U', 'sitcama_ci', '-d', 'sitcama_ci']); ready = true; break; }
      catch { await new Promise(r => setTimeout(r, 1000)); }
    }
    if (!ready) throw new Error('Disposable PostgreSQL did not become ready');
    const mapping = JSON.parse(run('docker', ['inspect', container]))[0].NetworkSettings.Ports['5432/tcp'][0];
    const env = { ...process.env, TEST_PGHOST: '127.0.0.1', TEST_PGPORT: mapping.HostPort,
      TEST_PGDATABASE: 'sitcama_ci', TEST_PGUSER: 'sitcama_ci', TEST_PGPASSWORD: password };
    // Invoke npm through Node so Windows and Linux use the exact same commands.
    const npm = resolve(process.execPath, '..', process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : '../lib/node_modules/npm/bin/npm-cli.js');
    const npmCli = process.env.npm_execpath || npm;
    const npmStep = (name, script, cwd) => step(name, process.execPath, [npmCli, 'run', script], cwd, env);
    await step('API coverage (80% each metric)', process.execPath, [npmCli, 'run', 'test:cov', '--', '--json', '--outputFile=../../.reports/devsecops/api-tests.json'], 'apps/api', env);
    await npmStep('API build', 'build', 'apps/api');
    await npmStep('Frontend coverage (80% each metric)', 'test:cov', 'apps/mobile');
    await npmStep('Frontend lint', 'lint', 'apps/mobile');
    await step('Ionic production build', process.execPath, ['node_modules/@ionic/cli/bin/ionic', 'build'], 'apps/mobile', env);
    await npmStep('Browser E2E (isolated schemas, 360/768/1440)', 'test:e2e', 'apps/mobile');
    if (results.some(r => r.status !== 'passed')) process.exitCode = 1;
  } catch (error) { results.push({ name: 'test infrastructure', status: 'failed', error: error.message }); process.exitCode = 1; }
  finally {
    if (container) run('docker', ['rm', '-f', container]);
    json('tests.json', { started, finished: new Date().toISOString(), postgres: lock.postgres, ephemeral: true, results });
  }
})();
