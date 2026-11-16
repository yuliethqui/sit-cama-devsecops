// Collect existing results only. Does not execute tests or change production code.
const fs = require('node:fs');
const { resolve, relative, dirname } = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const root = resolve(__dirname, '..');
const input = resolve(root, '.reports/tests');
const output = resolve(root, 'docs/evidence/tests');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const result = (stage, file) => read(resolve(input, stage, file));
const apiRequire = createRequire(resolve(root, 'apps/api/package.json'));
const coverage = stage => apiRequire('istanbul-lib-coverage').createCoverageMap(result(stage, 'api-coverage.json')).getCoverageSummary().data;
const before = { api: result('before','api-tests.json'), frontend: result('before','frontend-tests.json'), e2e: result('before','e2e-tests.json') };
const after = { api: result('after','api-tests.json'), frontend: result('after','frontend-tests.json'), e2e: result('after','e2e-tests.json'), probe: result('after','audit-probe.json') };
const summary = {
  collected: new Date().toISOString(), node: process.version, platform: process.platform,
  baseline: { api: before.api.numPassedTests, frontend: before.frontend.numPassedTests, e2e: before.e2e.stats.expected },
  expandedPassingRuns: { api: after.api.numPassedTests, frontend: after.frontend.numPassedTests, e2e: after.e2e.stats.expected },
  finalAuditProbe: { passed: after.probe.numPassedTests, failed: after.probe.numFailedTests },
  uniqueFinalCases: { api: after.api.numTotalTests + after.probe.numTotalTests, frontend: after.frontend.numTotalTests, e2e: after.e2e.stats.expected + after.e2e.stats.unexpected },
  newCases: { api: after.api.numTotalTests + after.probe.numTotalTests - before.api.numTotalTests,
    frontend: after.frontend.numTotalTests - before.frontend.numTotalTests, e2e: after.e2e.stats.expected - before.e2e.stats.expected },
  fullFinalApiSuiteRerunAfterDefect: false,
  status: 'Stopped at reproduced production validation defect; regression left enabled, production unchanged',
  coverage: { before: { api: coverage('before'), frontend: result('before','frontend-coverage.json').total },
    afterExpandedPassingRuns: { api: coverage('after'), frontend: result('after','frontend-coverage.json').total },
    limitation: 'API after coverage belongs to the complete 203-case passing run, before adding the final 3-case audit probe. No coverage claimed for a green final API suite.' },
  defect: result('after','audit-observation.json'),
};
if (before.api.numFailedTests || before.frontend.numFailedTests || before.e2e.stats.unexpected || after.api.numFailedTests || after.frontend.numFailedTests || after.e2e.stats.unexpected) throw new Error('Unexpected failure in the passing phase; review counts');
if (after.probe.numFailedTests !== 1 || summary.defect.actualStatus !== 200 || summary.defect.expectedStatus !== 400) throw new Error('Unexpected probe result; review defect report');
fs.mkdirSync(output,{recursive:true});
const files = {
  before: ['tests.json','api-tests.json','frontend-tests.json','e2e-tests.json','api-coverage.json','frontend-coverage.json'],
  after: ['api-tests.json','frontend-tests.json','e2e-tests.json','api-coverage.json','frontend-coverage.json',
    'api-run.json','e2e-run.json','probe-run.json','audit-probe.json','audit-observation.json','audit-probe.log'],
};
for (const [stage, names] of Object.entries(files)) for (const name of names) {
  const source=resolve(input,stage,name),target=resolve(output,stage,name);const data=fs.readFileSync(source);
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(data.toString())) throw new Error(`Possible JWT in ${stage}/${name}`);
  fs.mkdirSync(dirname(target),{recursive:true});fs.writeFileSync(target,data);
}
fs.copyFileSync(resolve(input,'preservation.json'),resolve(output,'preservation.json'));
fs.writeFileSync(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
const entries=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=resolve(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.name!=='manifest.json')entries.push({file:relative(output,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:sha(file)});}}
walk(output);fs.writeFileSync(resolve(output,'manifest.json'),JSON.stringify(entries,null,2)+'\n');
console.log(JSON.stringify({baseline:summary.baseline,passingPhase:summary.expandedPassingRuns,probe:summary.finalAuditProbe,newCases:summary.newCases,evidenceFiles:entries.length},null,2));
