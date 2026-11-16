// Increment 07 evidence collection. Never overwrites the original Entrega 3 report.
const fs = require('node:fs');
const { resolve, relative, dirname } = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const { root, lock } = require('./lib.cjs');
const input = resolve(root, '.reports/incremento-07');
const output = resolve(root, 'docs/evidence/incremento-07');
fs.mkdirSync(output, { recursive: true });
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (name, data) => fs.writeFileSync(resolve(output, name), JSON.stringify(data, null, 2) + '\n');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const applicability = {
  'CVE-2026-53613': 'Local mount/fstab/privileged pathname race; no mount subprocess in the API. Package absent from final runtime; original exploitability not asserted.',
  'CVE-2026-53615': 'Crafted partition metadata probed by libblkid; API does not probe disks. Package absent from final runtime.',
  'CVE-2026-78410': 'Privileged restricted bind-mount source race; no SUID mount path in application flow. Package absent from final runtime.',
  'CVE-2026-41992': 'GNU gzip executable processing LZW/LZH inputs; distinct from Node zlib streams. Executable/package absent from final runtime.',
  'CVE-2026-54369': 'Privileged pathname ACL operations with symlink race; no application ACL calls found. Package absent from final runtime.',
  'CVE-2025-6020': 'pam_namespace OS-session module; authentication uses JWT/argon2, not PAM. PAM packages absent from final runtime.',
  'CVE-2026-16742': 'systemd-homed service/group management; homed is not the API. Source-package mapping alone does not prove library exploitability. Packages absent from final runtime.',
  'CVE-2025-69720': 'infocmp command parser; no terminal/infocmp subprocess in API. ncurses packages absent from final runtime.',
  'CVE-2026-9538': 'Perl Archive::Tar; no Perl invocation in API. Exact module presence in original was not established; perl-base absent from final runtime.',
  'CVE-2023-45853': 'Debian bookworm zlib binary omits MiniZip; affected symbol absent from libz, Node and loaded argon2 ELF. Specific draft VEX only, never applied. Final Debian zlib also newer/fixed.',
  'CVE-2026-76844': 'Advisory description names webpack-dev-middleware while Debian maps it to zlib. Mapping inconsistency retained for review; final Debian package has the stated fixed version. No broad suppression.',
  'CVE-2026-85091': 'gz* file-writer error path: Debian library fixed in final runtime, but Node embeds separate zlib/gz_write symbols. JS/NAPI triggering path not established; publication risk review remains blocked.',
};
const original = read(resolve(root, 'docs/evidence/devsecops/trivy-image.json'));
const historic = original.Results.flatMap(r => (r.Vulnerabilities || []).filter(v => ['HIGH','CRITICAL'].includes(v.Severity)).map(v => ({ ...v, target: r.Target })));
if (historic.length !== 39) throw new Error('Unexpected original baseline; review before collecting');
const profiles = {};
for (const label of ['bookworm','trixie','distroless','final']) {
  const directory = resolve(input, label);
  const report = read(resolve(directory, 'trivy-image.json'));
  const gate = read(resolve(directory, 'trivy-image-gate.json'));
  const image = read(resolve(directory, 'image.json'));
  const runtime = read(resolve(directory, 'runtime-audit.json'));
  profiles[label] = { image: image.image, imageId: image.imageId, archiveSha256: image.archiveSha256,
    scanDate: report.CreatedAt, trivy: report.Trivy.Version, os: report.Metadata.OS,
    sizeBytes: report.Metadata.Size, sbomComponents: image.components,
    totalFindings: gate.count, critical: gate.blocking.filter(v => v.severity === 'CRITICAL').length,
    high: gate.blocking.filter(v => v.severity === 'HIGH').length,
    medium: gate.findings.filter(v => v.severity === 'MEDIUM').length,
    low: gate.findings.filter(v => v.severity === 'LOW').length,
    unknown: gate.findings.filter(v => v.severity === 'UNKNOWN').length,
    blocking: gate.blocking.length, packages: runtime.packages.length, node: runtime.node, glibc: runtime.glibc };
}
const currentBaseline = read(resolve(input, 'bookworm/trivy-image-gate.json')).blocking;
if (currentBaseline.length !== 39) throw new Error('Current baseline differs; explicitly reassess the comparison');
const finalRuntime = read(resolve(input, 'final/runtime-audit.json'));
const finalVulnerabilities = read(resolve(input, 'final/trivy-image-gate.json')).findings;
const packages = new Map(finalRuntime.packages.map(p => [p.name, p.version]));
const rows = historic.map(v => ({ cve: v.VulnerabilityID, package: v.PkgName, severity: v.Severity,
  installed: v.InstalledVersion, fixedInOriginalReport: v.FixedVersion || null, originalStatus: v.Status,
  title: v.Title, finalVersion: packages.get(v.PkgName) || null,
  finalReported: finalVulnerabilities.some(f => f.id === v.VulnerabilityID && f.package === v.PkgName),
  disposition: packages.has(v.PkgName) ? 'OS package updated; evaluate Node embedded copy separately where noted' : 'Package physically absent in minimal runtime',
  applicability: applicability[v.VulnerabilityID], primaryURL: v.PrimaryURL,
}));
write('blocking-before-after.json', rows);
write('profiles.json', profiles);
const groups = Object.values(Object.groupBy(rows, row => row.cve)).map(group => ({ cve: group[0].cve, severity: group[0].severity,
  packageFindings: group.length, packages: group.map(v => `${v.package} ${v.installed}`), fixedInOriginal: [...new Set(group.map(v => v.fixedInOriginalReport))],
  remainingOnFinalScan: group.filter(v => v.finalReported).length, applicability: group[0].applicability }));
write('grouped-cves.json', groups);
const csv = value => '"' + String(value ?? '').replaceAll('"','""') + '"';
const columns = ['cve','package','severity','installed','fixedInOriginalReport','originalStatus','finalVersion','finalReported','disposition','applicability'];
fs.writeFileSync(resolve(output, 'blocking-before-after.csv'), [columns.join(','), ...rows.map(row => columns.map(key => csv(row[key])).join(','))].join('\n') + '\n');
const markdown = ['# Comparación generada desde reportes Trivy y paquetes de los contenedores', '',
  '| Perfil | CRITICAL | HIGH | MEDIUM | LOW | UNKNOWN | Total | Paquetes Debian | SBOM |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...Object.entries(profiles).map(([name,p]) => `| ${name} | ${p.critical} | ${p.high} | ${p.medium} | ${p.low} | ${p.unknown} | ${p.totalFindings} | ${p.packages} | ${p.sbomComponents} |`), '',
  'Los números HIGH/CRITICAL son pares paquete–CVE; los 39 originales contienen 12 CVE distintos. No se aplicó VEX ni se ignoraron vulnerabilidades sin parche.', '',
  '| CVE original | Severidad | Pares originales | Paquetes | Versión corregida en informe original | Pares presentes en escaneo final |',
  '|---|---|---:|---|---|---:|', ...groups.map(g => `| ${g.cve} | ${g.severity} | ${g.packageFindings} | ${g.packages.join('<br>')} | No indicada | ${g.remainingOnFinalScan} |`), '',
  'El detalle de versiones finales y aplicabilidad de los 39 pares está en blocking-before-after.csv / .json. Los riesgos de la zlib embebida de Node se conservan aparte; un escaneo limpio no aprueba la publicación.', ''];
fs.writeFileSync(resolve(output, 'comparison.md'), markdown.join('\n'));
const checks = read(resolve(input, 'final/runtime-verification.json'));
const dast = read(resolve(input, 'final/dast.json'));
if (checks.status !== 'passed' || dast.status !== 'passed') throw new Error('Final runtime or DAST checks failed');
const baseSignature = read(resolve(input, 'final/base-signature.json'));
if (!baseSignature.signatures?.length || baseSignature.base !== lock.containerBases.runtime) throw new Error('Missing matching base verification');
const apiRequire = createRequire(resolve(root, 'apps/api/package.json'));
const coverage = apiRequire('istanbul-lib-coverage').createCoverageMap(read(resolve(input, 'final/linux/coverage/coverage-final.json'))).getCoverageSummary().data;
write('coverage-summary.json', coverage);
const before = read(resolve(input, 'protected-before.json'));
const changed = Object.entries(before).filter(([file, expected]) => hash(resolve(root, file)) !== expected).map(([file]) => file.replaceAll('\\','/'));
if (changed.some(file => file !== 'apps/api/test/beds.integration.spec.ts')) throw new Error(`Unexpected protected changes: ${changed.join(', ')}`);
const databaseBefore = read(resolve(input, 'database-before.json')), databaseAfter = read(resolve(input, 'database-after.json'));
if (JSON.stringify(databaseBefore) !== JSON.stringify(databaseAfter)) throw new Error('Existing database fingerprint changed: review, do not claim preservation');
const containersBefore = fs.readFileSync(resolve(input, 'containers-before.txt'), 'utf8').trim();
const containersAfter = fs.readFileSync(resolve(input, 'containers-after.txt'), 'utf8').trim();
if (containersBefore !== containersAfter) throw new Error('Existing containers changed: review');
write('preservation.json', { timestamp: new Date().toISOString(), checkedFiles: Object.keys(before).length, changed,
  envUnchanged: hash(resolve(root, '.env')) === before['.env'], databaseUnchanged: true,
  tables: databaseAfter.map(t => ({ table: t.table_name, rows: t.rows, fingerprintUnchanged: true })),
  existingContainersUnchanged: true, note: 'Original Entrega 3 evidence and running containers retained; only a test env fallback changed' });
const zlib = historic.find(v => v.VulnerabilityID === 'CVE-2023-45853');
const oldImage = read(resolve(input, 'bookworm/image.json'));
const oldRuntime = read(resolve(input, 'bookworm/runtime-audit.json'));
if (oldRuntime.miniZipPackages.length || !oldRuntime.systemZlibElf.length || oldRuntime.systemZlibElf.some(e => !e.analyzed || e.affectedSymbol)) throw new Error('MiniZip evidence contradicts VEX draft');
write('vex-proposal-bookworm.json', { '@context': 'https://openvex.dev/ns/v0.2.0', '@id': `urn:uuid:${randomUUID()}`,
  author: 'SIT-CAMA local technical assessment — unsigned DRAFT, not an approval', timestamp: new Date().toISOString(), version: 1,
  statements: [{ vulnerability: { '@id': 'https://nvd.nist.gov/vuln/detail/CVE-2023-45853', name: 'CVE-2023-45853' },
    products: [{ '@id': `urn:${oldImage.imageId}`, subcomponents: [{ '@id': zlib.PkgIdentifier?.PURL || `pkg:deb/debian/zlib1g@${encodeURIComponent(zlib.InstalledVersion)}?arch=amd64` }] }],
    status: 'not_affected', justification: 'vulnerable_code_not_present',
    impact_statement: 'DRAFT scoped ONLY to the Debian zlib1g binary in the exact original image: Debian documents contrib/minizip is not built; no minizip package or zipOpenNewFileInZip4_64 symbol in libz/Node/loaded argon2 was found. Not consumed by Trivy or release policy; not an assertion that the entire image is secure.' }] });
write('summary.json', { collected: new Date().toISOString(), profiles, distinctOriginalCves: groups.length,
  removedOriginalPackageCvePairs: rows.filter(r => !r.finalReported).length, originalPairs: rows.length,
  finalRuntimeChecks: checks, apiCoverage: coverage, dast,
  publicationReview: read(resolve(root, '.ci/publication-review.json')),
  recommendation: 'Trivy HIGH/CRITICAL gate passes; DO NOT unlock publication until the independent Node bundled-zlib review is resolved. No registry publication or own-image signature performed.',
  githubActionsExecuted: false, ownImageSigned: false, baseSignatureVerified: true,
  trivyDatabase: read(resolve(root, '.cache/incremento-07/trixie/trivy/db/metadata.json')),
  trivyDatabaseSha256: hash(resolve(root, '.cache/incremento-07/trixie/trivy/db/trivy.db')) });
const allow = ['image.json','trivy-image.json','trivy-image-gate.json','sbom.cdx.json','runtime-audit.json',
  'runtime-verification.json','cross-runtime.json','dast.json','zap-medico.json','zap-medico.html','zap-auditor.json','zap-auditor.html','base-signature.json',
  'gitleaks.json','gitleaks-scope.json','semgrep.json','semgrep-gate.json','trivy-api.json','trivy-api-gate.json','trivy-mobile.json','trivy-mobile-gate.json','trivy-config.json','trivy-config-gate.json'];
for (const label of Object.keys(profiles)) {
  for (const file of allow) {
    const source = resolve(input, label, file);
    if (!fs.existsSync(source)) continue;
    fs.mkdirSync(resolve(output, label), { recursive: true }); fs.copyFileSync(source, resolve(output, label, file));
  }
}
for (const file of ['api-tests.json','coverage/coverage-final.json']) {
  const source = resolve(input, 'final/linux', file), target = resolve(output, 'final/linux', file);
  fs.mkdirSync(dirname(target), { recursive: true }); fs.copyFileSync(source, target);
}
const policy = fs.readFileSync(resolve(input, 'policy.tap'), 'utf8');
if (!/# fail 0/.test(policy)) throw new Error('Publication/scanning policy tests did not pass');
fs.copyFileSync(resolve(input, 'policy.tap'), resolve(output, 'policy.tap'));
const files = [];
function walk(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const file=resolve(directory,entry.name); if(entry.isDirectory())walk(file); else if(entry.name!=='manifest.json')files.push(file); } }
walk(output);
write('manifest.json', files.map(file => ({ file: relative(output,file).replaceAll('\\','/'), bytes: fs.statSync(file).size, sha256: hash(file) })));
console.log(`Collected ${files.length} evidence files; 39 original findings removed, publication review remains blocked.`);
