import * as argon2 from 'argon2';
import { Pool } from 'pg';

const [email, role] = process.argv.slice(2);
const password = process.env.DEMO_SEED_PASSWORD;
const roles = ['ENFERMERO', 'MEDICO', 'ADMISIONES', 'COORDINADOR', 'SERVICIOS', 'AUDITOR'];
if (!email || !roles.includes(role) || !password || password.length < 12) {
  console.error('Uso: DEMO_SEED_PASSWORD (variable de entorno), npm run db:seed-user -- correo@ejemplo.test ROL');
  process.exit(1);
}
const pool = new Pool();
async function main() {
  const hash = await argon2.hash(password);
  await pool.query('INSERT INTO users(email,role,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET role=EXCLUDED.role, password_hash=EXCLUDED.password_hash', [email.toLowerCase(), role, hash]);
  console.log('Usuario de prueba creado:', email, role);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
