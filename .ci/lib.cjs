const { spawnSync, spawn } = require('node:child_process');
const { resolve, sep } = require('node:path');
const { mkdirSync, writeFileSync } = require('node:fs');
const root = resolve(__dirname, '..');
function workspaceOutput(variable, parent, fallback) {
  const directory = resolve(root, process.env[variable] || fallback);
  if (!directory.startsWith(resolve(root, parent) + sep)) throw new Error(`Invalid ${variable}: must stay under ${parent}`);
  return directory;
}
const reports = workspaceOutput('SITCAMA_REPORT_DIR', '.reports', '.reports/devsecops');
const cache = workspaceOutput('SITCAMA_CACHE_DIR', '.cache', '.cache/devsecops');
mkdirSync(reports, { recursive: true });
const lock = require('./tools.lock.json');
// Trust only the read-only container mount; Ubuntu checkout is owned by runner UID.
const gitMountTrust = ['-e', 'GIT_CONFIG_COUNT=1', '-e', 'GIT_CONFIG_KEY_0=safe.directory', '-e', 'GIT_CONFIG_VALUE_0=/repo'];
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed (${result.status}): ${(result.stderr || result.stdout || '').slice(-2500)}`);
  return (result.stdout || '').trim();
}
function execute(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} ${args[0]} exited ${code}`)));
  });
}
function json(name, value) { writeFileSync(resolve(reports, name), JSON.stringify(value, null, 2) + '\n'); }
function mask(value) { if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${value}`); }
module.exports = { root, reports, cache, lock, run, execute, json, mask, gitMountTrust, workspaceOutput };
