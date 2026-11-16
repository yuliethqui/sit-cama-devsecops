// Public verification only: no signing, registry upload or OIDC request.
const { lock, run, json } = require('./lib.cjs');
const base = lock.containerBases.runtime;
if (!/^gcr\.io\/distroless\/cc-debian13:nonroot@sha256:[a-f0-9]{64}$/.test(base)) throw new Error('Unexpected runtime base');
const issuer = 'https://accounts.google.com';
const identity = 'keyless@distroless.iam.gserviceaccount.com';
const signatures = JSON.parse(run('cosign', ['verify', '--certificate-oidc-issuer', issuer, '--certificate-identity', identity, '--output', 'json', base]));
if (!Array.isArray(signatures) || !signatures.length) throw new Error('No verified base signature');
json('base-signature.json', { verified: new Date().toISOString(), base, issuer, identity, signatures });
console.log('Distroless base signature and exact issuer/identity verified.');
