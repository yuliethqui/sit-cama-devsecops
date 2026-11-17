// Read-only runtime/ELF inventory. No application secrets or patient data are read.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function elfSymbols(file) {
  const data = fs.readFileSync(file);
  const result = { file, sha256: crypto.createHash('sha256').update(data).digest('hex'), bytes: data.length };
  if (data.readUInt32BE(0) !== 0x7f454c46 || data[4] !== 2 || data[5] !== 1) return { ...result, analyzed: false, reason: 'Not ELF64 little-endian' };
  const base = Number(data.readBigUInt64LE(40));
  const size = data.readUInt16LE(58), count = data.readUInt16LE(60);
  if (!base || !count || base + size * count > data.length) return { ...result, analyzed: false, reason: 'No section table' };
  const names = [];
  for (let section = 0; section < count; section++) {
    const position = base + section * size;
    if (![2,11].includes(data.readUInt32LE(position + 4))) continue;
    const start = Number(data.readBigUInt64LE(position + 24)), bytes = Number(data.readBigUInt64LE(position + 32));
    const entry = Number(data.readBigUInt64LE(position + 56));
    const linked = base + data.readUInt32LE(position + 40) * size;
    const stringBase = Number(data.readBigUInt64LE(linked + 24));
    if (!entry || start + bytes > data.length) throw new Error('Invalid ELF symbol table');
    for (let cursor = start; cursor < start + bytes; cursor += entry) {
      const offset = stringBase + data.readUInt32LE(cursor);
      const end = data.indexOf(0, offset);
      if (end !== -1) names.push(data.toString('utf8', offset, end));
    }
  }
  return { ...result, analyzed: true, symbols: names.length,
    affectedSymbol: names.includes('zipOpenNewFileInZip4_64'),
    minizipSymbols: [...new Set(names.filter(name => /^(zip|unz)(Open|Close|Read|Write|Get|Set|Locate|Go)/.test(name)))],
    gzWriteSymbols: [...new Set(names.filter(name => /^(gz_write|gzwrite|gzfwrite|gzclearerr)$/.test(name)))],
    affectedSymbolString: data.includes(Buffer.from('zipOpenNewFileInZip4_64')) };
}
function packages() {
  let text = fs.existsSync('/var/lib/dpkg/status') ? fs.readFileSync('/var/lib/dpkg/status', 'utf8') : '';
  if (fs.existsSync('/var/lib/dpkg/status.d')) for (const file of fs.readdirSync('/var/lib/dpkg/status.d')) {
    if (!file.endsWith('.md5sums')) text += '\n\n' + fs.readFileSync(path.join('/var/lib/dpkg/status.d', file), 'utf8');
  }
  return text.split(/\n\s*\n/).map(block => ({ name: /^Package: (.+)$/m.exec(block)?.[1], version: /^Version: (.+)$/m.exec(block)?.[1] })).filter(p => p.name);
}
(async () => {
  const argon2 = require('argon2');
  const password = crypto.randomBytes(32).toString('base64url');
  const hash = await argon2.hash(password);
  if (!await argon2.verify(hash, password) || await argon2.verify(hash, password + 'wrong')) throw new Error('Native argon2 failed');
  const report = process.report.getReport();
  const libs = [...new Set([process.execPath, ...report.sharedObjects].filter(file => fs.existsSync(file) && /\.so|\.node$|\/node$/.test(file)))];
  const relevantPackages = packages();
  const source = fs.readFileSync(require.resolve('argon2'), 'utf8');
  const probe = { timestamp: new Date().toISOString(), platform: process.platform, arch: process.arch,
    uid: process.getuid(), gid: process.getgid(), node: process.version, versions: process.versions,
    glibc: report.header.glibcVersionRuntime, nativeArgon2: true,
    argon2Version: JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve('argon2')), 'package.json'))).version,
    nodeCryptoRoundTrip: (() => { const key=crypto.randomBytes(32),iv=crypto.randomBytes(12); const c=crypto.createCipheriv('aes-256-gcm',key,iv,{authTagLength:16}); const body=Buffer.concat([c.update('synthetic'),c.final()]); const d=crypto.createDecipheriv('aes-256-gcm',key,iv,{authTagLength:16});d.setAuthTag(c.getAuthTag());return Buffer.concat([d.update(body),d.final()]).toString()==='synthetic'; })(),
    caCertificates: fs.existsSync('/etc/ssl/certs/ca-certificates.crt'),
    shellPresent: fs.existsSync('/bin/sh'), npmPresent: fs.existsSync('/usr/local/lib/node_modules/npm'),
    packages: relevantPackages, miniZipPackages: relevantPackages.filter(p => /minizip|pyminizip/i.test(p.name)),
    loadedElf: libs.map(elfSymbols),
    systemZlibElf: [...new Set(['/lib/x86_64-linux-gnu/libz.so.1','/usr/lib/x86_64-linux-gnu/libz.so.1'].filter(file => fs.existsSync(file)).map(file => fs.realpathSync(file)))].map(elfSymbols),
    argon2ReferencesMinizip: /minizip|zipOpenNewFileInZip4_64/.test(source) };
  if (probe.uid === 0 || !probe.nodeCryptoRoundTrip) throw new Error('Runtime security/compatibility probe failed');
  console.log(JSON.stringify(probe, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
