// Local emulator verification. Temporarily replaces only the API listener, restores Docker in finally.
// All users, secrets, patients and audit rows belong to a fresh private schema; none are printed.
const { _android, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const { apiRequire, connection, Pool, snapshot } = require('./database.cjs');
apiRequire('reflect-metadata');
const { NestFactory } = apiRequire('@nestjs/core');
const { JwtService } = apiRequire('@nestjs/jwt');
const argon2 = apiRequire('argon2');
const { AppModule } = require('../../api/dist/app.module.js');
const { configureApp } = require('../../api/dist/configure-app.js');
const root = resolve(__dirname, '../../..');
const schema = `sitcama_android_test_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(30).toString('base64url');
const admin = new Pool({ ...connection, options: '-c search_path=pg_catalog' });
let app, sql, device, page, before, created = false, stopped = false;
function compose(...args) {
  execFileSync('docker', ['compose', '-f', 'compose.yaml', '-f', 'compose.dev.yaml', ...args],
    { cwd: root, stdio: 'pipe', timeout: 60000 });
}
async function main() {
  const devices = await _android.devices({ omitDriverInstall: true });
  device = devices.find(item => item.serial().startsWith('emulator-'));
  if (!device) throw new Error('Inicie el emulador e instale el APK debug actualizado.');
  before = await snapshot(admin);
  await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
  sql = new Pool({ ...connection, options: `-c search_path=${schema}` });
  await sql.query(readFileSync(resolve(__dirname, '../../api/db/001_initial.sql'), 'utf8')
    .replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
  const hash = await argon2.hash(password);
  const actors = {};
  for (const role of ['MEDICO', 'ENFERMERO', 'AUDITOR', 'SERVICIOS']) {
    actors[role] = randomUUID();
    await sql.query('INSERT INTO users(id,email,role,password_hash) VALUES($1,$2,$3,$4)',
      [actors[role], `${role.toLowerCase()}@android.test`, role, hash]);
  }
  Object.assign(process.env, { NODE_ENV: 'test', APP_ORIGIN: 'https://localhost',
    PGHOST: connection.host, PGPORT: String(connection.port), PGDATABASE: connection.database,
    PGUSER: connection.user, PGPASSWORD: connection.password, PGOPTIONS: `-c search_path=${schema}`,
    JWT_SECRET: randomBytes(48).toString('base64'), PATIENT_DATA_KEY: randomBytes(32).toString('base64'),
    PATIENT_HMAC_KEY: randomBytes(32).toString('base64') });
  compose('stop', 'api'); stopped = true;
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app); await app.listen(3000, '127.0.0.1');
  const token = await app.get(JwtService).signAsync({ sub: actors.ENFERMERO, role: 'ENFERMERO' });
  async function register(critical = true) {
    const response = await fetch('http://localhost:3000/api/patients', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: `DEMO-${randomUUID().replaceAll('-', '')}`, fullName: 'SENTINEL_PRIVADO_ANDROID',
        triage: { chiefComplaint: 'Motivo ficticio privado', spo2: critical ? 84 : 98, glasgow: 15, eva: 1,
          paroInminente: false, dolorToracicoTipico: false } }),
    });
    assert.equal(response.status, 201); return response.json();
  }
  await device.shell('am force-stop edu.sitcama.mvp');
  await device.shell('am start -n edu.sitcama.mvp/.MainActivity');
  page = await (await device.webView({ pkg: 'edu.sitcama.mvp' })).page();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  async function login(role) {
    await expect(page.getByLabel('Correo electrónico')).toHaveClass(/ng-pristine/, { timeout: 20000 });
    await page.getByLabel('Correo electrónico').fill(`${role.toLowerCase()}@android.test`);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tu espacio de trabajo' })).toBeVisible({ timeout: 20000 });
  }
  await login('MEDICO');
  await page.locator('a[href="/app/panel"]:visible').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Habilitar sonido de aviso' }).click();
  await expect(page.getByRole('button', { name: 'Sonido habilitado' })).toBeVisible();
  const saved = await register();
  await expect(page.getByRole('alert')).toContainText('Nuevo triaje I', { timeout: 20000 });
  await expect(page.locator(`[data-patient="${saved.patientId}"]`)).toHaveCount(1);
  await expect(page.locator('main')).not.toContainText('SENTINEL');
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/android-panel-medico.png', scale: 'css' });
  console.log('Android: login MEDICO, panel, sonido habilitado y aviso I nativo correctos.');
  // Closing the Engine.IO transport exercises native reconnection without stopping the database.
  const { RealtimeGateway } = require('../../api/dist/realtime/realtime.gateway.js');
  const gateway = app.get(RealtimeGateway);
  console.log('Conexiones médicas antes del corte:', gateway.server.sockets.size);
  assert.equal(gateway.server.sockets.size, 1);
  const publish = gateway.notify;
  let pending;
  gateway.notify = async () => undefined; // Simulate a best-effort notice lost during a network gap.
  try { pending = await register(false); } finally { gateway.notify = publish; }
  const reconnected = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('El transporte nativo no reconectó')), 15000);
    gateway.server.once('connection', () => { clearTimeout(timer); resolve(); });
  });
  for (const socket of [...gateway.server.sockets.values()]) {
    console.log('Transporte previo al corte:', socket.connected, socket.conn.readyState, socket.conn.transport.name);
    socket.conn.once('close', reason => console.log('Cierre observado por servidor:', reason));
    socket.conn.transport.socket.terminate(); // Abrupt TCP loss, rather than a graceful protocol close.
  }
  await reconnected;
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toBeVisible({ timeout: 20000 });
  await expect(page.locator(`[data-patient="${pending.patientId}"]`)).toHaveCount(1, { timeout: 20000 });
  console.log('Android: reconexión con recuperación HTTP correcta.');
  // Background/resume keeps the session only in process memory and recovers the HTTP snapshot.
  await device.shell('input keyevent KEYCODE_HOME');
  await device.shell('am start -n edu.sitcama.mvp/.MainActivity');
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toBeVisible({ timeout: 20000 });
  await expect(page.locator(`[data-patient="${saved.patientId}"]`)).toHaveCount(1);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login('AUDITOR');
  await page.locator('a[href="/app/audit"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Consulta de auditoría' })).toBeVisible();
  if (!(await page.locator('app-filter-disclosure details').evaluate(el => el.open))) {
    await page.locator('app-filter-disclosure summary').click();
  }
  await expect(page.locator('select[formControlName="action"]')).toHaveClass(/ng-pristine/);
  await page.getByLabel('Acción', { exact: true }).selectOption('RECORD_TRIAGE');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.locator('.audit-event')).toHaveCount(2);
  await expect(page.locator('main')).not.toContainText('SENTINEL');
  await page.screenshot({ path: 'test-results/android-auditoria.png', scale: 'css' });
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login('SERVICIOS');
  await expect(page.locator('a[href="/app/panel"]')).toHaveCount(0);
  await expect(page.locator('a[href="/app/audit"]')).toHaveCount(0);
  expect(await page.evaluate(() => Object.values(localStorage).concat(Object.values(sessionStorage)).join(' '))).not.toMatch(/access_token|patientId|SENTINEL/);
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  console.log('Android: panel + aviso nativo + reconexión + reapertura + auditoría + SERVICIOS verificados con datos ficticios.');
}
main().catch(async error => {
  console.error(error.message); process.exitCode = 1;
  if (page) {
    await page.screenshot({ path: 'test-results/android-panel-error.png', scale: 'css' }).catch(() => undefined);
    console.log('Estado Android:', await page.getByRole('status').allTextContents().catch(() => []));
    console.log('Errores visibles:', await page.getByRole('alert').allTextContents().catch(() => []));
  }
}).finally(async () => {
  try {
    await device?.close(); await app?.close(); await sql?.end();
    if (created) {
      if (!/^sitcama_android_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Esquema temporal inválido');
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      assert.deepEqual(await snapshot(admin), before, 'Las tablas públicas deben permanecer intactas');
      console.log('Android: esquema temporal eliminado; tablas públicas sin cambios.');
    }
  } finally {
    await admin.end(); if (stopped) { compose('start', 'api'); console.log('API Docker restaurada.'); }
  }
});
