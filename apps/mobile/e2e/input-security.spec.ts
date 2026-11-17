import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function login(page: Page, role = 'ENFERMERO'): Promise<void> {
  await page.goto('/');
  await expect(page.getByLabel('Correo electrónico')).toHaveClass(/ng-pristine/);
  await page.getByLabel('Correo electrónico').fill(`${role.toLowerCase()}@mobile.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env['SITCAMA_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu espacio de trabajo' })).toBeVisible();
}
async function registerForm(page: Page): Promise<void> {
  await page.locator('a[href="/app/register"]:visible').first().click();
  await expect(page.locator('app-register input[formControlName="document"]')).toHaveClass(/ng-pristine/);
  await page
    .getByLabel('Documento exacto', { exact: true })
    .fill(`INC08-${randomUUID().replaceAll('-', '').slice(0, 20)}`);
  await page.getByLabel('Nombre completo sintético').fill('Persona ficticia Inc08');
  await page.getByLabel('Motivo de consulta sintético').fill('Prueba ficticia de recuperación');
  await page.getByLabel('SpO₂ (%)').fill('98');
  await page.getByLabel('Escala de Glasgow').fill('15');
  await page.getByLabel('Dolor · EVA').fill('1');
}

test('escapa marcado recibido en un código de cama y conserva 38 tarjetas', async ({ page }) => {
  await login(page, 'COORDINADOR');
  const payload = '<img data-inc08 src=x onerror="window.__inc08=true">';
  // Controlled response fixture tests the DOM sink; it never changes PostgreSQL.
  await page.route('**/api/beds', async (route) => {
    const response = await route.fetch();
    const beds = await response.json();
    beds[0].code = payload;
    await route.fulfill({ response, json: beds });
  });
  await page.locator('a[href="/app/beds"]:visible').first().click();
  await expect(page.getByTestId('bed-card')).toHaveCount(38);
  await expect(page.getByTestId('bed-card').filter({ hasText: payload })).toHaveCount(1);
  await expect(page.locator('img[data-inc08]')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, '__inc08'))).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Asignar', exact: true })).toHaveCount(0);
});

test('una respuesta de registro perdida no provoca reenvío automático y el reintento manual informa duplicado', async ({
  page,
}) => {
  await login(page);
  await registerForm(page);
  let submissions = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/patients')) submissions++;
  });
  await page.route('**/api/patients', async (route) => {
    const committed = await route.fetch();
    expect(committed.status()).toBe(201);
    await route.abort();
  });
  await page.getByRole('button', { name: 'Registrar y consultar resultado' }).click();
  await expect(page.locator('app-register [role="alert"]')).toContainText('No hay conexión con la API');
  expect(submissions).toBe(1);
  await page.unroute('**/api/patients');
  await page.getByRole('button', { name: 'Registrar y consultar resultado' }).click();
  await expect(page.locator('app-register [role="alert"]')).toContainText('ya está registrado');
  expect(submissions).toBe(2);
});

test('un 401 del panel elimina la sesión, cierra Socket.IO y no presenta texto hostil del error', async ({ page }) => {
  await login(page, 'MEDICO');
  const opening = page.waitForEvent('websocket');
  await page.locator('a[href="/app/panel"]:visible').first().click();
  const socket = await opening;
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toBeVisible();
  const payload = '<img data-inc08 src=x onerror="window.__inc08=true">';
  await page.route('**/api/triage/panel?*', (route) => route.fulfill({ status: 401, json: { message: payload } }));
  await page.getByRole('button', { name: 'Actualizar panel', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?reason=expired$/);
  await expect.poll(() => socket.isClosed()).toBe(true);
  await expect(page.locator('app-panel')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(payload);
  expect(await page.evaluate(() => Reflect.get(window, '__inc08'))).toBeUndefined();
});

test('Atrás después de logout no recupera la confirmación del paciente ni una ruta clínica', async ({ page }) => {
  await login(page);
  await registerForm(page);
  const saved = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/api/patients'),
  );
  await page.getByRole('button', { name: 'Registrar y consultar resultado' }).click();
  const patientId = (await (await saved).json()).patientId as string;
  await expect(page.getByRole('heading', { name: 'Paciente sintético registrado' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('body')).not.toContainText(patientId);
  await expect(page.locator('app-register')).toHaveCount(0);
});
