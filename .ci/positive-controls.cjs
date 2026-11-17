// Synthetic failures exist only in disposable fixtures, never application code/history.
const { mkdtempSync, writeFileSync, copyFileSync, rmSync, mkdirSync, chmodSync } = require('node:fs');
const { resolve, sep } = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { root, reports, lock, run, json } = require('./lib.cjs');
const dir = mkdtempSync(resolve(root, '.cache/devsecops/positive-'));
try {
  copyFileSync(resolve(root, '.gitleaks.toml'), resolve(dir, '.gitleaks.toml'));
  run('git', ['init', '--quiet', dir]);
  writeFileSync(resolve(dir, 'probe.txt'), `github_token = "${'ghp_' + randomBytes(24).toString('hex').slice(0,36)}"\n`);
  run('git', ['-C', dir, 'add', 'probe.txt']);
  const secret = spawnSync(process.execPath, [resolve(root, '.ci/precommit.cjs')], { cwd: dir, encoding: 'utf8' });
  if (secret.status !== 1 || !/leaks found/i.test(secret.stderr + secret.stdout)) throw new Error('Gitleaks positive control did not detect staged secret');
  mkdirSync(resolve(dir, '.ci'));
  for (const file of ['precommit.cjs', 'lib.cjs', 'tools.lock.json']) copyFileSync(resolve(root, '.ci', file), resolve(dir, '.ci', file));
  copyFileSync(resolve(root, '.githooks/pre-commit'), resolve(dir, '.git/hooks/pre-commit'));
  chmodSync(resolve(dir, '.git/hooks/pre-commit'), 0o755);
  const commitArgs = ['-C', dir, '-c', 'user.name=SIT-CAMA isolated test', '-c', 'user.email=control@example.test', 'commit', '--quiet', '--no-gpg-sign', '-m', 'Local synthetic precommit control'];
  const rejectedCommit = spawnSync('git', commitArgs, { encoding: 'utf8' });
  if (rejectedCommit.status !== 1 || !/leaks found/i.test(rejectedCommit.stderr + rejectedCommit.stdout)) throw new Error('Actual Git hook did not block commit');
  writeFileSync(resolve(dir, 'probe.txt'), 'SIT-CAMA synthetic clean fixture\n');
  run('git', ['-C', dir, 'add', 'probe.txt']);
  const clean = spawnSync(process.execPath, [resolve(root, '.ci/precommit.cjs')], { cwd: dir, encoding: 'utf8' });
  if (clean.status !== 0) throw new Error('Clean staged input was unexpectedly rejected');
  run('git', commitArgs);
  writeFileSync(resolve(dir, 'probe.js'), 'function isolatedProbe(req, db) { return db.query("SELECT * FROM beds WHERE code=" + req.query.code); }\n');
  const sast = spawnSync('docker', ['run', '--rm', '--mount', `type=bind,source=${dir},target=/probe,readonly`,
    '--mount', `type=bind,source=${resolve(root, '.ci/rules')},target=/rules,readonly`, lock.semgrep,
    'semgrep', 'scan', '--config', '/rules/sitcama.yml', '--metrics=off', '--disable-version-check', '--error', '/probe/probe.js'], { encoding: 'utf8' });
  if (sast.status !== 1 || !/sitcama.pg-input-concatenation/.test(sast.stdout)) throw new Error('SAST SQL injection positive control failed');
  run(process.execPath, ['--test', '.ci/policy.test.cjs']);
  json('positive-controls.json', { timestamp: new Date().toISOString(), stagedGitleaksExit: secret.status, cleanStagedExit: clean.status, nativeHookRejectedCommit: rejectedCommit.status, cleanCommit: 'passed',
    semgrepSqlInjectionExit: sast.status, scaPolicyUnitTest: 'passed', scope: 'Local disposable fixtures; NOT a GitHub PR blocking demonstration' });
  console.log('Local positive controls: staged secret and SQL injection rejected; SCA policy tested.');
} finally {
  if (!dir.startsWith(resolve(root, '.cache/devsecops') + sep)) throw new Error('Unsafe fixture cleanup path');
  rmSync(dir, { recursive: true, force: true });
}
