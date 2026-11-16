// Read-only backend smoke: fictitious/nonexistent credentials must reach Docker and return 401.
const { _android, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { mkdirSync } = require('node:fs');

(async () => {
  const devices = await _android.devices({ omitDriverInstall: true });
  const device = devices.find(item => item.serial().startsWith('emulator-'));
  if (!device) throw new Error('Inicie el emulador Android antes de la prueba.');
  try {
    await device.shell('am force-stop edu.sitcama.mvp');
    await device.shell('am start -n edu.sitcama.mvp/.MainActivity');
    const view = await device.webView({ pkg: 'edu.sitcama.mvp' });
    const page = await view.page();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await expect(page.getByLabel('Correo electrónico')).toBeVisible({ timeout: 20000 });
    await expect(page.getByLabel('Correo electrónico')).toHaveClass(/ng-pristine/);
    await page.getByLabel('Correo electrónico').fill(`unmatched-${randomUUID()}@emulator.test`);
    await page.getByLabel('Contraseña', { exact: true }).fill(randomUUID());
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos', { timeout: 20000 });
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
    await expect(page.getByText('La conexión segura no está configurada.', { exact: false })).toHaveCount(0);
    expect(errors).toEqual([]);
    const persisted = await page.evaluate(() => Object.values(localStorage).concat(Object.values(sessionStorage)).join(' '));
    expect(persisted).not.toMatch(/access_token|Bearer|unmatched-|patientId/);
    mkdirSync('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/android-debug-login.png', scale: 'css' });
    await page.getByLabel('Correo electrónico').fill('');
    console.log('Android debug: el login llegó a Docker, mostró el 401 esperado y no persistió la sesión.');
  } finally { await device.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
