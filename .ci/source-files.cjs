// Git is already required by checkout/Gitleaks. No rg or new package is needed.
const { execFileSync } = require('node:child_process');
const { lstatSync } = require('node:fs');
const { resolve, sep, isAbsolute } = require('node:path');
function listSourceFiles(directory, command = execFileSync) {
  const output = command('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: directory, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true,
  });
  const files = [];
  for (const file of new Set(output.split('\0').filter(Boolean))) {
    if (file === '.git' || file.startsWith('.git/') || file.startsWith('docs/evidence/')) continue;
    const source = resolve(directory, file);
    if (isAbsolute(file) || file.includes('\\') || !source.startsWith(resolve(directory) + sep)) {
      throw new Error('Unsafe source path');
    }
    if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.env.example')) {
      throw new Error('Secret env file in scan input');
    }
    let info;
    try { info = lstatSync(source); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Non-regular source file');
    files.push(file);
  }
  return files.sort();
}
module.exports = { listSourceFiles };
