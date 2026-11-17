// Test data is generated in memory and piped directly between disposable runtimes.
const { randomBytes } = require('node:crypto');
const argon2 = require('argon2');
const { ConfigService } = require('@nestjs/config');
const { PatientDataService } = require('./dist/patients/patient-data.service');
const identity = { document: 'DEMO-INC07', fullName: 'Persona Sintetica' };
const context = 'identity:synthetic-runtime-compatibility';
async function generate() {
  const password = randomBytes(32).toString('base64url');
  const keys = { PATIENT_DATA_KEY: randomBytes(32).toString('base64'), PATIENT_HMAC_KEY: randomBytes(32).toString('base64') };
  const service = new PatientDataService(new ConfigService(keys));
  console.log(JSON.stringify({ password, hash: await argon2.hash(password), keys,
    encrypted: service.encrypt(identity, context).toString('base64'), hmac: service.documentHmac(identity.document) }));
}
async function verify(input) {
  const service = new PatientDataService(new ConfigService(input.keys));
  const checks = { hash: await argon2.verify(input.hash, input.password), wrongPasswordRejected: !await argon2.verify(input.hash, input.password + 'wrong'),
    identity: JSON.stringify(service.decrypt(Buffer.from(input.encrypted, 'base64'), context)) === JSON.stringify(identity),
    hmac: service.documentHmac(identity.document) === input.hmac };
  if (Object.values(checks).some(value => !value)) throw new Error('Cross-runtime compatibility failed');
  console.log(JSON.stringify(checks));
}
if (process.argv[2] === 'generate') generate().catch(() => { process.exitCode = 1; });
else { let input = ''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => verify(JSON.parse(input)).catch(() => { process.exitCode = 1; })); }
