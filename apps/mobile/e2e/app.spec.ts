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
async function navigate(page: Page, path: string): Promise<void> {
  await page.locator(`a[href="/app/${path}"]:visible`).first().click();
  await expect(page).toHaveURL(new RegExp(`/app/${path}$`));
  await expect(page.locator(`app-${path}`)).toBeVisible();
  if (path === 'register' || path === 'search') {
    await expect(page.locator(`app-${path} input[formControlName="document"]`)).toHaveClass(/ng-pristine/);
  }
}
async function fillPatient(page: Page, document: string, spo2 = '84', eva = '2'): Promise<void> {
  await page.getByLabel('Documento exacto', { exact: true }).fill(document);
  await page.getByLabel('Nombre completo sintético').fill('Persona Sintética E2E');
  await page.getByLabel('Motivo de consulta sintético').fill('Motivo ficticio para prueba académica');
  await page.getByLabel('SpO₂ (%)').fill(spo2);
  await page.getByLabel('Escala de Glasgow').fill('15');
  await page.getByLabel('Dolor · EVA').fill(eva);
}
test('protege rutas, muestra validaciones y rechaza credenciales inválidas', async ({ page }, testInfo) => {
  await page.goto('/app/register');
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: testInfo.outputPath('login.png'), scale: 'css' });
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByText('Ingresa un correo electrónico válido.')).toBeVisible();
  await page.getByLabel('Correo electrónico').fill('inexistente@mobile.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(randomUUID());
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos');
});
test('registro real I, búsqueda limitada, ausencia y documento duplicado', async ({ page }, testInfo) => {
  const document = `DEMO-${randomUUID().replaceAll('-', '')}`;
  await login(page);
  await navigate(page, 'register');
  await page.screenshot({ path: testInfo.outputPath('registro.png'), scale: 'css' });
  await page.getByRole('button', { name: 'Registrar y consultar resultado' }).click();
  await expect(page.getByRole('alert')).toContainText('Revisa los campos');
  await fillPatient(page, document);
  await page.getByRole('button', { name: 'Registrar y consultar resultado' }).click();
  await expect(page.getByRole('heading', { name: 'Paciente sintético registrado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nivel I propuesto por la API' })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar otro paciente' }).click();
  await expect(page.getByLabel('Nombre completo sintético')).toHaveValue('');
  await fillPatient(page, document);
  await page.getByRole('button', { name: 'Registrar y consultar resultado' }).click();
  await expect(page.getByRole('alert')).toContainText('El documento ya está registrado');
  await navigate(page, 'search');
  await page.getByLabel('Documento exacto').fill(document);
  await expect(page.getByLabel('Documento exacto')).toHaveValue(document);
  const searchResponse = page.waitForResponse((response) => response.url().endsWith('/api/patients/search'));
  await page.getByRole('button', { name: 'Buscar paciente', exact: true }).click();
  expect((await searchResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Registro encontrado' })).toBeVisible();
  await expect(page.locator('app-triage-summary')).toContainText('Nivel I');
  await page.screenshot({ path: testInfo.outputPath('busqueda.png'), scale: 'css' });
  await expect(page.locator('main')).not.toContainText('Persona Sintética E2E');
  await expect(page.locator('main')).not.toContainText('Motivo ficticio para prueba académica');
  expect(
    await page.evaluate(() => Object.values(localStorage).concat(Object.values(sessionStorage)).join(' ')),
  ).not.toMatch(/access_token|DEMO-|Persona Sintética/);
  await page.getByLabel('Documento exacto').fill(`NONE-${randomUUID().replaceAll('-', '')}`);
  await page.getByLabel('Documento exacto').press('Enter');
  await expect(page.getByRole('heading', { name: 'Sin coincidencias' })).toBeVisible();
});
test('respeta II y pendiente sin inventar III–V', async ({ page }) => {
  await login(page, 'MEDICO');
  await navigate(page, 'register');
  for (const [eva, heading] of [
    ['8', 'Nivel II propuesto por la API'],
    ['1', 'Pendiente de revisión clínica'],
  ]) {
    await fillPatient(page, `DEMO-${randomUUID().replaceAll('-', '')}`, '98', eva);
    await page.getByRole('button', { name: 'Registrar y consultar resultado' }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Registrar otro paciente' }).click();
  }
});
for (const role of ['ENFERMERO', 'MEDICO', 'ADMISIONES', 'COORDINADOR', 'SERVICIOS', 'AUDITOR']) {
  test(`menú, censo, filtros y sesión temporal para ${role}`, async ({ page }, testInfo) => {
    await login(page, role);
    const register = page.locator('a[href="/app/register"]:visible');
    const search = page.locator('a[href="/app/search"]:visible');
    expect((await register.count()) > 0).toBe(['ENFERMERO', 'MEDICO'].includes(role));
    expect((await search.count()) > 0).toBe(['ENFERMERO', 'MEDICO', 'ADMISIONES'].includes(role));
    await navigate(page, 'beds');
    await expect(page.getByTestId('bed-card')).toHaveCount(38);
    if (role !== 'MEDICO') {
      await expect(page.getByRole('button', { name: 'Asignar', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Liberar', exact: true })).toHaveCount(0);
    }
    if (role !== 'SERVICIOS')
      await expect(page.getByRole('button', { name: 'Completar limpieza', exact: true })).toHaveCount(0);
    await page.getByLabel('Servicio', { exact: true }).selectOption('AISLAMIENTO');
    await expect(page.getByTestId('bed-card')).toHaveCount(3);
    await page.getByLabel('Estado', { exact: true }).selectOption('OCCUPIED');
    await expect(page.getByRole('heading', { name: 'Sin resultados' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(page.getByTestId('bed-card')).toHaveCount(38);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (role === 'COORDINADOR') await page.screenshot({ path: testInfo.outputPath('censo.png'), scale: 'css' });
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, role);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });
}
test('muestra error de red y permite reintentar el censo', async ({ page }) => {
  await login(page);
  await page.route('**/api/beds', (route) => route.abort());
  await navigate(page, 'beds');
  await expect(page.getByRole('alert')).toContainText('No hay conexión con la API');
  await page.unroute('**/api/beds');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByTestId('bed-card')).toHaveCount(38);
});
