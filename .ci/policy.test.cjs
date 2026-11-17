const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { trivyGate } = require('./security.cjs');
const { assertPublicationReview } = require('./release-policy.cjs');
test('SCA policy blocks HIGH/CRITICAL including unfixed findings, retains moderate visibility', () => {
  const gate = trivyGate({ Results: [{ Target: 'test fixture', Vulnerabilities: [
    { VulnerabilityID: 'fixture-high', Severity: 'HIGH' },
    { VulnerabilityID: 'fixture-critical', Severity: 'CRITICAL', FixedVersion: '2' },
    { VulnerabilityID: 'fixture-medium', Severity: 'MEDIUM' },
  ] }] });
  assert.equal(gate.blocking.length, 2);
  assert.equal(gate.count, 3);
  assert.equal(gate.blocking[0].fixed, null);
  assert.throws(() => trivyGate({}), /did not complete/);
  assert.throws(() => trivyGate({ Results: [] }), /did not complete/);
});
test('publication refuses a local invocation before any registry operation', () => {
  const result = spawnSync(process.execPath, [resolve(__dirname, 'publish.cjs')], {
    env: { ...process.env, GITHUB_ACTIONS: 'false' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Publication requires the reviewed manual main workflow/);
});
test('publication stays blocked despite a clean scan until matching image risks are reviewed', () => {
  const current = require('./publication-review.json');
  const bases = require('./tools.lock.json').containerBases;
  assert.throws(() => assertPublicationReview(current, bases), /unresolved image risk/);
  assert.throws(() => assertPublicationReview({ ...current, status: 'approved' }, bases), /unresolved image risk/);
  const approved = { status: 'approved', unresolved: [], scope: bases };
  assert.doesNotThrow(() => assertPublicationReview(approved, bases));
  assert.throws(() => assertPublicationReview({ ...approved, scope: { ...bases, runtime: 'different-digest' } }, bases), /does not match/);
});
