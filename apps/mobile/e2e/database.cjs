const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { readFileSync, existsSync } = require('node:fs');
const { parseEnv } = require('node:util');
const apiRequire = createRequire(resolve(__dirname, '../../api/package.json'));
const { Pool } = apiRequire('pg');
const envPath = resolve(__dirname, '../../../.env');
const local = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const connection = {
  host: process.env.TEST_PGHOST || '127.0.0.1', port: Number(process.env.TEST_PGPORT || 5432),
  database: process.env.TEST_PGDATABASE || local.POSTGRES_DB || 'sitcama',
  user: process.env.TEST_PGUSER || local.POSTGRES_USER || 'sitcama',
  password: process.env.TEST_PGPASSWORD ?? local.POSTGRES_PASSWORD, connectionTimeoutMillis: 3000,
};
function schemaName() {
  const schema = process.env.SITCAMA_E2E_SCHEMA;
  if (!/^sitcama_mobile_test_[a-f0-9]{32}$/.test(schema || '')) throw new Error('Esquema temporal inválido');
  return schema;
}
async function snapshot(pool) {
  const result = {};
  for (const table of ['users', 'beds', 'bed_assignments', 'patients', 'triage_records', 'audit_events']) {
    const exists = await pool.query('SELECT to_regclass($1) AS name', [`public.${table}`]);
    if (exists.rows[0].name) result[table] = (await pool.query(`SELECT count(*)::integer AS count,
      md5(string_agg(row_to_json(t)::text,',' ORDER BY id)) AS fingerprint FROM public.${table} t`)).rows[0];
  }
  return result;
}
module.exports = { apiRequire, connection, Pool, schemaName, snapshot };
