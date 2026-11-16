const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, sep } = require('node:path');
const { execFileSync } = require('node:child_process');
const { listSourceFiles } = require('./source-files.cjs');
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'sitcama-inc09-source-'));
  t.after(() => {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep + 'sitcama-inc09-source-')) throw new Error('Unsafe fixture cleanup');
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, file(name) {
    mkdirSync(resolve(directory, name, '..'), { recursive: true });
    writeFileSync(join(directory, name), 'synthetic fixture\n');
  } };
}
const output = files => () => files.join('\0') + '\0';
test('uses Git NUL output for tracked/untracked/hidden files, spaces, duplicates and deleted files', t => {
  const f = fixture(t);
  for (const name of ['tracked.ts', 'untracked.ts', '.hidden', 'with space.ts']) f.file(name);
  let called = false;
  const files = listSourceFiles(f.directory, (command, args, options) => {
    called = true;
    assert.equal(command, 'git');
    assert.deepEqual(args, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
    assert.equal(options.cwd, f.directory);
    return output(['untracked.ts', '.hidden', 'tracked.ts', 'with space.ts', 'tracked.ts', 'deleted.ts'])();
  });
  assert.equal(called, true);
  assert.deepEqual(files, ['.hidden', 'tracked.ts', 'untracked.ts', 'with space.ts']);
});
test('excludes Git metadata and historical evidence without excluding application source', t => {
  const f = fixture(t); f.file('apps/api/src/main.ts');
  assert.deepEqual(listSourceFiles(f.directory, output(['.git/config', 'docs/evidence/summary.json', 'apps/api/src/main.ts'])), ['apps/api/src/main.ts']);
});
test('rejects secret env files even when returned as tracked, preserving env.example', t => {
  const f = fixture(t); f.file('.env.example');
  assert.deepEqual(listSourceFiles(f.directory, output(['.env.example'])), ['.env.example']);
  for (const name of ['.env', '.env.production', 'apps/api/.env.local']) {
    f.file(name);
    assert.throws(() => listSourceFiles(f.directory, output([name])), /Secret env file/);
  }
});
test('fails closed on paths outside the checkout', t => {
  const f = fixture(t);
  for (const name of ['../outside.ts', resolve(f.directory, 'absolute.ts'), '..\\outside.ts']) {
    assert.throws(() => listSourceFiles(f.directory, output([name])), /Unsafe source path/);
  }
});
test('rejects non-regular source entries instead of silently truncating the scan', t => {
  const f = fixture(t); mkdirSync(join(f.directory, 'directory'));
  assert.throws(() => listSourceFiles(f.directory, output(['directory'])), /Non-regular source file/);
});
test('propagates Git failures instead of reporting an empty successful scan', t => {
  const f = fixture(t); const failure = new Error('Git unavailable');
  assert.throws(() => listSourceFiles(f.directory, () => { throw failure; }), error => error === failure);
});
test('enumerates this real checkout with Git without creating commits, staging or requiring rg', () => {
  const directory = resolve(__dirname, '..');
  const files = listSourceFiles(directory, (command, args, options) => execFileSync(command,
    ['-c', `safe.directory=${directory}`, ...args], { ...options, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }));
  for (const file of ['.ci/security.cjs', '.gitleaks.toml', 'apps/api/package-lock.json', 'apps/mobile/package-lock.json', 'apps/api/db/001_initial.sql']) {
    assert.ok(files.includes(file), file);
  }
  assert.ok(!files.some(file => /^(\.git\/|\.cache\/|\.reports\/|docs\/evidence\/)/.test(file)));
});
