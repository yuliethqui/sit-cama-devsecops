// Collect only explicitly allowed reports; no env, raw scanner workdir or image archive.
const { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { root, reports, lock, run } = require('./lib.cjs');
const destination = resolve(root, 'docs/evidence/devsecops');
mkdirSync(destination, { recursive: true });
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8').replace(/^\uFEFF/, ''));
const previous = read('docs/evidence/tema-azul/protected-sha256.json');
const differences = Object.entries(previous).filter(([path, hash]) => !existsSync(resolve(root, path)) || createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex') !== hash).map(([path]) => path);
const permitted = ['apps/api/src/patients/patient-data.service.ts', 'apps/mobile/src/app/core/api.service.spec.ts',
  'apps/mobile/src/app/patients/register.page.spec.ts', 'apps/mobile/src/app/patients/search.page.spec.ts',
  'apps/mobile/e2e/database.cjs', 'apps/mobile/package.json', 'apps/mobile/package-lock.json', 'apps/mobile/angular.json', 'apps/mobile/src/test-setup.ts'];
if (differences.some(path => !permitted.includes(path))) throw new Error('Unexpected change against previous protected baseline');
const protectedState = { baseline: 'docs/evidence/tema-azul/protected-sha256.json', checkedFiles: Object.keys(previous).length,
  checkedAndroidAndEnvironmentFiles: Object.keys(previous).filter(path => /android|capacitor|environment/.test(path)).length,
  differences, note: 'Only expected implementation/test/config changes; .env was not in that baseline. No claim of a pre-task .env hash.',
  timestamp: new Date().toISOString() };
writeFileSync(resolve(reports, 'preservation.json'), JSON.stringify(protectedState, null, 2) + '\n');
const quality = read('.reports/devsecops/tests.json');
if (quality.results.some(r => r.status !== 'passed')) throw new Error('Test results contain failures; do not report a passing delivery');
const image = read('.reports/devsecops/image.json');
const vulnerabilities = read('.reports/devsecops/trivy-image-gate.json');
const frontCoverage = read('apps/mobile/coverage/app/coverage-summary.json').total;
const audit = read('.reports/devsecops/dast.json');
if (audit.status !== 'passed' || audit.scans.some(s => s.authenticatedReads < 1)) throw new Error('DAST must prove authenticated access');
const apiTests = read('.reports/devsecops/api-tests.json');
const frontendTests = read('.reports/devsecops/frontend-tests.json');
const e2eTests = read('.reports/devsecops/e2e-tests.json');
if (apiTests.numFailedTests || frontendTests.numFailedTests || e2eTests.stats.unexpected) throw new Error('Raw test reports contain failures');
const apiRequire = createRequire(resolve(root, 'apps/api/package.json'));
const coverage = apiRequire('istanbul-lib-coverage').createCoverageMap(read('apps/api/coverage/coverage-final.json')).getCoverageSummary().data;
const summary = { collected: new Date().toISOString(), platform: process.platform, node: process.version, tools: lock,
  tests: quality.results, counts: { api: apiTests.numPassedTests, frontendUnit: frontendTests.numPassedTests, browserE2e: e2eTests.stats.expected },
  frontendCoverage: frontCoverage, backendCoverage: coverage,
  sastRules: read('.ci/rules/owasp-javascript.json').rules.length + 2,
  image: { ...image, blockingFindings: vulnerabilities.blocking.length,
    critical: vulnerabilities.blocking.filter(v => v.severity === 'CRITICAL').length,
    high: vulnerabilities.blocking.filter(v => v.severity === 'HIGH').length },
  dast: audit, cosign: 'NOT EXECUTED: requires GitHub OIDC and authorized registry publication',
  githubActions: 'NOT EXECUTED', gitHistory: 'NOT CHECKED: workspace export has no .git',
  releaseDecision: vulnerabilities.blocking.length ? 'BLOCKED by image policy' : 'Pending GitHub verification and review' };
writeFileSync(resolve(reports, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
const files = ['summary.json', 'tests.json', 'api-tests.json', 'frontend-tests.json', 'e2e-tests.json', 'preservation.json', 'gitleaks.json', 'gitleaks-scope.json',
  'positive-controls.json', 'semgrep.json', 'semgrep.sarif', 'semgrep-gate.json', 'trivy-api-gate.json', 'trivy-api.json',
  'trivy-mobile-gate.json', 'trivy-mobile.json', 'npm-mobile-audit.json', 'trivy-config-gate.json', 'trivy-config.json', 'trivy-image-gate.json', 'trivy-image.json',
  'image.json', 'sbom.cdx.json', 'dast.json', 'zap-medico.json', 'zap-medico.html', 'zap-auditor.json', 'zap-auditor.html'];
const manifest = [];
for (const file of files) {
  const content = readFileSync(resolve(reports, file));
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(content.toString())) throw new Error(`Possible JWT in report: ${file}`);
  copyFileSync(resolve(reports, file), resolve(destination, file));
  manifest.push({ file, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
}
writeFileSync(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Collected ${files.length} reports; release decision: ${summary.releaseDecision}`);
