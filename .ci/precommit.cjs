// Shared by pre-commit (Python) and the native Git hook (no Python/Go required).
const { run, lock, gitMountTrust } = require('./lib.cjs');
try {
  const repo = run('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
  const staged = run('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: repo }).split(/\r?\n/);
  if (staged.some(p => /(^|\/)\.env($|\.)/.test(p) && !p.endsWith('.env.example'))) throw new Error('Do not commit environment secret files');
  run('docker', ['run', '--rm', ...gitMountTrust, '--mount', `type=bind,source=${repo},target=/repo,readonly`, lock.gitleaks,
    'git', '/repo', '--pre-commit', '--staged', '--redact=100', '--config=/repo/.gitleaks.toml']);
  console.log('Gitleaks staged: passed');
} catch (error) { console.error(error.message); process.exitCode = 1; }
