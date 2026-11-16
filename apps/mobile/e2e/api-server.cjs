// Real NestJS + PostgreSQL, isolated from all existing application data.
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { apiRequire, connection, Pool, schemaName } = require('./database.cjs');
apiRequire('reflect-metadata');
const { NestFactory } = apiRequire('@nestjs/core');
const argon2 = apiRequire('argon2');
const { AppModule } = require('../../api/dist/app.module.js');
const { configureApp } = require('../../api/dist/configure-app.js');
const schema = schemaName();
let app;
async function main() {
  const admin = new Pool(connection);
  try { await admin.query(`CREATE SCHEMA "${schema}"`); } finally { await admin.end(); }
  const sql = new Pool({ ...connection, options: `-c search_path=${schema}` });
  try {
    const initial = readFileSync(resolve(__dirname, '../../api/db/001_initial.sql'), 'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
    await sql.query(initial);
    if (!process.env.SITCAMA_E2E_PASSWORD) throw new Error('Falta secreto efímero de pruebas');
    const hash = await argon2.hash(process.env.SITCAMA_E2E_PASSWORD);
    for (const role of ['ENFERMERO', 'MEDICO', 'ADMISIONES', 'COORDINADOR', 'SERVICIOS', 'AUDITOR']) {
      await sql.query('INSERT INTO users(id,email,role,password_hash) VALUES($1,$2,$3,$4)', [randomUUID(), `${role.toLowerCase()}@mobile.test`, role, hash]);
    }
  } finally { await sql.end(); }
  Object.assign(process.env, {
    NODE_ENV: 'test', APP_ORIGIN: 'http://localhost:4200', PGHOST: connection.host, PGPORT: String(connection.port),
    PGDATABASE: connection.database, PGUSER: connection.user, PGPASSWORD: connection.password,
    PGOPTIONS: `-c search_path=${schema}`, JWT_SECRET: randomBytes(48).toString('base64'),
    PATIENT_DATA_KEY: randomBytes(32).toString('base64'), PATIENT_HMAC_KEY: randomBytes(32).toString('base64'),
  });
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app); await app.listen(3101, '127.0.0.1');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app?.close(); process.exit(0); });
main().catch(async () => {
  const cleanup = new Pool(connection);
  try { await cleanup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } finally { await cleanup.end(); }
  console.error('La API E2E no pudo iniciar; compruebe PostgreSQL y compile apps/api.'); process.exit(1);
});
