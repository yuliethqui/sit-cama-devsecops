// Executed only inside the isolated API image against its private PostgreSQL.
const { Pool } = require('pg');
const argon2 = require('argon2');
const { randomUUID } = require('node:crypto');
(async () => {
  if (process.env.SITCAMA_DAST_ISOLATED !== 'true' || process.env.PGDATABASE !== 'sitcama_dast') throw new Error('Refusing non-DAST database');
  const pool = new Pool();
  try {
    const hash = await argon2.hash(process.env.DAST_PASSWORD);
    for (const role of ['MEDICO', 'AUDITOR', 'SERVICIOS']) await pool.query(
      'INSERT INTO users(id,email,role,password_hash) VALUES($1,$2,$3,$4)',
      [randomUUID(), `${role.toLowerCase()}@dast.test`, role, hash]);
  } finally { await pool.end(); }
})().catch(() => { console.error('Isolated DAST seeding failed'); process.exitCode = 1; });
