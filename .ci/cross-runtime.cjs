const { resolve } = require('node:path');
const { root, run, json, mask } = require('./lib.cjs');
const original = process.env.SITCAMA_ORIGINAL_IMAGE || 'sitcama-api:devsecops';
const candidate = process.env.SITCAMA_CI_IMAGE || 'sitcama-api:inc07-final';
const fixture = resolve(root, '.ci/runtime-hash-fixture.cjs');
const args = ['run', '--rm', '-i', '--network', 'none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
  '--mount', `type=bind,source=${fixture},target=/app/runtime-hash-fixture.cjs,readonly`];
function direction(from, to) {
  const data = run('docker', [...args, from, 'node', '/app/runtime-hash-fixture.cjs', 'generate']);
  const parsed = JSON.parse(data);
  for (const secret of [parsed.password, ...Object.values(parsed.keys)]) mask(secret);
  return JSON.parse(run('docker', [...args, to, 'node', '/app/runtime-hash-fixture.cjs', 'verify'], { input: data }));
}
const result = { timestamp: new Date().toISOString(), original, candidate,
  oldToNew: direction(original, candidate), newToOld: direction(candidate, original),
  note: 'Synthetic password hashes, AES-GCM v1 and document HMAC only; no production keys/data read or stored' };
json('cross-runtime.json', result); console.log('Argon2, AES-GCM v1 and HMAC verified in both directions.');
