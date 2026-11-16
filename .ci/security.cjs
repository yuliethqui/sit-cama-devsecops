// The same pinned tools and blocking policies are used locally and by Actions.
const { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } = require('node:fs');
const { resolve, relative, dirname } = require('node:path');
const { createHash } = require('node:crypto');
const { root, reports, cache, lock, run, json, gitMountTrust, workspaceOutput } = require('./lib.cjs');
const mode = process.argv[2];
const image = process.env.SITCAMA_CI_IMAGE || 'sitcama-api:devsecops';
const trivyCache = workspaceOutput('SITCAMA_TRIVY_CACHE_DIR', '.cache', resolve(cache, 'trivy'));
mkdirSync(cache, { recursive: true });
const mount = (path, target, readonly = true) => ['--mount', `type=bind,source=${path},target=${target}${readonly ? ',readonly' : ''}`];
function docker(tool, args, mounts = []) {
  return run('docker', ['run', '--rm', ...mounts, lock[tool], ...args]);
}
function exportSource() {
  const destination = resolve(cache, 'source');
  // New directory every run prevents obsolete source files affecting scans.
  const { randomUUID } = require('node:crypto');
  const fresh = `${destination}-${randomUUID()}`;
  mkdirSync(fresh, { recursive: true });
  const files = run('rg', ['--files', '--hidden', '--no-require-git', '-g', '!.git', '-g', '!docs/evidence/**']).split(/\r?\n/).filter(Boolean);
  if (!files.length) throw new Error('Empty scan source');
  for (const file of files) {
    if (/(^|[\\/])\.env($|\.)/.test(file) && !file.endsWith('.env.example')) throw new Error('Secret env file in scan input');
    mkdirSync(dirname(resolve(fresh, file)), { recursive: true });
    cpSync(resolve(root, file), resolve(fresh, file));
  }
  json('source-manifest.json', { generated: new Date().toISOString(), files: files.map(path => ({
    path, sha256: createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex'),
  })) });
  return fresh;
}
function trivyGate(report) {
  if (!Array.isArray(report.Results) || !report.Results.length) throw new Error('Missing Trivy Results (scan did not complete)');
  const findings = report.Results.flatMap(r => [
    ...(r.Vulnerabilities || []).map(v => ({ target: r.Target, id: v.VulnerabilityID, package: v.PkgName, version: v.InstalledVersion, fixed: v.FixedVersion || null, severity: v.Severity })),
    ...(r.Misconfigurations || []).map(v => ({ target: r.Target, id: v.ID, severity: v.Severity, title: v.Title })),
  ]);
  return { count: findings.length, blocking: findings.filter(v => ['HIGH', 'CRITICAL'].includes(v.severity)), findings };
}
function scanTrivy(source, name, type, extra = []) {
  docker('trivy', [type, ...(type === 'config' ? [] : ['--scanners', 'vuln']), '--format', 'json',
    '--output', `/reports/${name}.json`, '--exit-code', '0', '--timeout', '15m', ...extra, '/source'],
    [...mount(source, '/source'), ...mount(reports, '/reports', false), ...mount(trivyCache, '/root/.cache/trivy', false)]);
  const report = JSON.parse(readFileSync(resolve(reports, `${name}.json`), 'utf8'));
  if (!report.Results?.length) throw new Error(`Trivy ${name} did not analyze any targets`);
  const gate = trivyGate(report);
  json(`${name}-gate.json`, gate);
  console.log(`${name}: ${gate.count} findings; ${gate.blocking.length} HIGH/CRITICAL`);
  return gate.blocking.length === 0;
}
function main() {
  mkdirSync(trivyCache, { recursive: true });
  if (mode === 'secrets') {
    if (existsSync(resolve(root, '.git'))) {
      const tracked = run('git', ['ls-files']).split(/\r?\n/);
      if (tracked.some(p => /(^|\/)\.env($|\.)/.test(p) && !p.endsWith('.env.example'))) throw new Error('An env secret file is tracked');
      docker('gitleaks', ['git', '/repo', '--log-opts=--all', '--redact=100', '--config=/repo/.gitleaks.toml', '--report-format=json', '--report-path=/reports/gitleaks.json'],
        [...gitMountTrust, ...mount(root, '/repo'), ...mount(reports, '/reports', false)]);
      json('gitleaks-scope.json', { scope: 'Git history', passed: true });
    } else {
      docker('gitleaks', ['dir', '/repo', '--redact=100', '--config=/repo/.gitleaks.toml', '--report-format=json', '--report-path=/reports/gitleaks.json'],
        [...mount(exportSource(), '/repo'), ...mount(reports, '/reports', false)]);
      json('gitleaks-scope.json', { scope: 'Exported source only; no .git available, history NOT checked', passed: true });
    }
  } else if (mode === 'source') {
    const source = exportSource();
    docker('semgrep', ['semgrep', 'scan', '--config', '/src/.ci/rules/owasp-javascript.json', '--config', '/src/.ci/rules/sitcama.yml',
      '--metrics=off', '--disable-version-check', '--strict', '--json-output=/reports/semgrep.json', '--sarif-output=/reports/semgrep.sarif', '/src/apps/api/src', '/src/apps/mobile/src'],
      [...mount(source, '/src'), ...mount(reports, '/reports', false)]);
    const sast = JSON.parse(readFileSync(resolve(reports, 'semgrep.json'), 'utf8'));
    if (!Array.isArray(sast.results) || sast.errors?.length) throw new Error('Semgrep returned scan errors');
    if (!sast.paths?.scanned?.length) throw new Error('Semgrep did not scan source files');
    const blocking = sast.results.filter(r => r.extra.severity === 'ERROR');
    json('semgrep-gate.json', { scannedFiles: sast.paths?.scanned?.length, findings: sast.results.length, blocking: blocking.length });
    let passed = blocking.length === 0;
    for (const app of ['api', 'mobile']) passed = scanTrivy(resolve(source, 'apps', app), `trivy-${app}`, 'fs', ['--include-dev-deps', '--skip-dirs', 'android']) && passed;
    passed = scanTrivy(source, 'trivy-config', 'config') && passed;
    if (!passed) throw new Error('SAST/SCA/IaC security policy blocked delivery; see reports');
  } else if (mode === 'image' || mode === 'image-existing') {
    const dockerfile = process.env.SITCAMA_DOCKERFILE || 'apps/api/Dockerfile';
    const definition = readFileSync(resolve(root, dockerfile), 'utf8');
    if (dockerfile === 'apps/api/Dockerfile' && (!definition.includes(`FROM ${lock.containerBases.build}`) || !definition.includes(`FROM ${lock.containerBases.runtime}`))) {
      throw new Error('Dockerfile and containerBases lock differ');
    }
    if (mode === 'image') run('docker', ['build', '--pull', '-t', image, '-f', dockerfile, 'apps/api']);
    const imageId = run('docker', ['image', 'inspect', image, '--format', '{{.Id}}']);
    const archive = resolve(cache, 'image');
    mkdirSync(archive, { recursive: true });
    run('docker', ['save', '-o', resolve(archive, 'api.tar'), image]);
    docker('syft', ['scan', 'docker-archive:/image/api.tar', '-o', 'cyclonedx-json=/reports/sbom.cdx.json'],
      [...mount(archive, '/image'), ...mount(reports, '/reports', false)]);
    docker('trivy', ['image', '--input', '/image/api.tar', '--scanners', 'vuln', '--format', 'json', '--output', '/reports/trivy-image.json', '--timeout', '15m'],
      [...mount(archive, '/image'), ...mount(reports, '/reports', false), ...mount(trivyCache, '/root/.cache/trivy', false)]);
    const gate = trivyGate(JSON.parse(readFileSync(resolve(reports, 'trivy-image.json'), 'utf8')));
    const sbom = JSON.parse(readFileSync(resolve(reports, 'sbom.cdx.json'), 'utf8'));
    if (sbom.bomFormat !== 'CycloneDX' || !sbom.components?.length) throw new Error('Invalid/empty SBOM');
    json('image.json', { image, imageId, build: mode === 'image' ? { dockerfile, sha256: createHash('sha256').update(definition).digest('hex') } : null,
      archiveSha256: createHash('sha256').update(readFileSync(resolve(archive, 'api.tar'))).digest('hex'),
      sbomFormat: sbom.bomFormat, sbomVersion: sbom.specVersion, components: sbom.components.length, generated: new Date().toISOString(), tools: lock });
    json('trivy-image-gate.json', gate);
    console.log(`Image: ${sbom.components.length} SBOM components; ${gate.blocking.length} blocking vulnerabilities`);
    if (gate.blocking.length) throw new Error('Image HIGH/CRITICAL vulnerabilities block publication');
  } else throw new Error('Usage: node .ci/security.cjs secrets|source|image|image-existing');
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { trivyGate };
