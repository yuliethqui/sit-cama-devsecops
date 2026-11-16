// Runs a selected API/E2E phase against a new PostgreSQL container, never .env.
const { randomBytes, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const { copyFileSync, existsSync } = require('node:fs');
const { root, reports, lock, run, execute, json, mask } = require('./lib.cjs');
const phase = process.argv[2];
if (!['api', 'e2e', 'probe'].includes(phase)) throw new Error('Usage: node .ci/test-08.cjs api|e2e|probe');
const name = `sitcama-inc08-${randomUUID()}`, password = randomBytes(32).toString('base64url'); mask(password);
const started = new Date().toISOString();
let container;
const result = { phase, started, isolated: true };
(async () => {
  try {
    container = run('docker', ['run','-d','--name',name,'--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=512m',
      '-p','127.0.0.1::5432','-e','POSTGRES_USER=sitcama_ci','-e','POSTGRES_DB=sitcama_ci','-e','POSTGRES_PASSWORD',lock.postgres],
      { env: { ...process.env, POSTGRES_PASSWORD: password } });
    let ready = false;
    for (let i=0;i<60;i++) {
      try { run('docker',['exec',container,'pg_isready','-U','sitcama_ci','-d','sitcama_ci']); ready=true;break; }
      catch { await new Promise(r=>setTimeout(r,1000)); }
    }
    if(!ready)throw new Error('Temporary PostgreSQL unavailable');
    const port=JSON.parse(run('docker',['inspect',container]))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
    const env={...process.env,TEST_PGHOST:'127.0.0.1',TEST_PGPORT:port,TEST_PGDATABASE:'sitcama_ci',TEST_PGUSER:'sitcama_ci',TEST_PGPASSWORD:password,SITCAMA_TEST_EVIDENCE_DIR:reports};
    if(phase==='e2e') {
      await execute(process.execPath,['node_modules/@playwright/test/cli.js','test'],{cwd:resolve(root,'apps/mobile'),env});
      copyFileSync(resolve(root,'.reports/devsecops/e2e-tests.json'),resolve(reports,'e2e-tests.json'));
    } else {
      const args=['node_modules/jest/bin/jest.js','--runInBand','--bail=1','--json',`--outputFile=${resolve(reports,phase==='probe'?'audit-probe.json':'api-tests.json')}`];
      if(phase==='probe')args.push('--runTestsByPath','test/audit-precision.regression.spec.ts');
      else args.push('--coverage');
      await execute(process.execPath,args,{cwd:resolve(root,'apps/api'),env});
    }
    result.status='passed';
  } catch(error) { result.status='failed';result.error=error.message;process.exitCode=1; }
  finally {
    if(phase==='api'&&existsSync(resolve(root,'apps/api/coverage/coverage-final.json')))copyFileSync(resolve(root,'apps/api/coverage/coverage-final.json'),resolve(reports,'api-coverage.json'));
    if(container)run('docker',['rm','-f',container]);
    result.finished=new Date().toISOString();json(`${phase}-run.json`,result);
  }
})();
