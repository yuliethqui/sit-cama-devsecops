const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { root, reports, run, json } = require('./lib.cjs');
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.GITHUB_REF !== 'refs/heads/main') {
  throw new Error('Publication requires the reviewed manual main workflow and GitHub OIDC');
}
require('./release-policy.cjs').assertPublicationReview(require('./publication-review.json'), require('./tools.lock.json').containerBases);
const repository = process.env.GH_REPOSITORY;
const sha = process.env.COMMIT_SHA;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Invalid repository/commit');
const archive = resolve(root, '.cache/devsecops/image/api.tar');
const metadata = JSON.parse(readFileSync(resolve(reports, 'image.json')));
const gate = JSON.parse(readFileSync(resolve(reports, 'trivy-image-gate.json')));
if (gate.blocking.length || createHash('sha256').update(readFileSync(archive)).digest('hex') !== metadata.archiveSha256) throw new Error('Image policy/checksum mismatch');
run('docker', ['load', '-i', archive]);
if (run('docker', ['image', 'inspect', metadata.image, '--format', '{{.Id}}']) !== metadata.imageId) throw new Error('Image identity mismatch');
const image = `ghcr.io/${repository.toLowerCase()}/api`;
const tag = `${image}:${sha}`;
try {
  run('docker', ['login', 'ghcr.io', '-u', process.env.GITHUB_ACTOR, '--password-stdin'], { input: process.env.GH_TOKEN });
  run('docker', ['tag', metadata.image, tag]);
  run('docker', ['push', tag]);
  const digest = JSON.parse(run('docker', ['image', 'inspect', tag]))[0].RepoDigests.find(d => d.startsWith(`${image}@sha256:`));
  if (!digest || !/@sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('Unexpected registry digest');
  const identity = `https://github.com/${repository}/.github/workflows/mvp-ci.yml@refs/heads/main`;
  const issuer = 'https://token.actions.githubusercontent.com';
  run('cosign', ['sign', '--yes', digest]);
  const verified = JSON.parse(run('cosign', ['verify', '--certificate-identity', identity, '--certificate-oidc-issuer', issuer, '--output', 'json', digest]));
  json('cosign-verification.json', { digest, identity, issuer, verified, timestamp: new Date().toISOString() });
  run('cosign', ['attest', '--yes', '--type', 'cyclonedx', '--predicate', resolve(reports, 'sbom.cdx.json'), digest]);
  const attestations = run('cosign', ['verify-attestation', '--type', 'cyclonedx', '--certificate-identity', identity, '--certificate-oidc-issuer', issuer, digest]);
  json('cosign-sbom.json', { digest, identity, issuer, attestations: attestations.split('\n').filter(Boolean).map(line => JSON.parse(line)) });
} finally { run('docker', ['logout', 'ghcr.io']); }
