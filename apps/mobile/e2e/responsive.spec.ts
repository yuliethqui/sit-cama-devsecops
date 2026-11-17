import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function capture(page: Page, info: TestInfo, name: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [
            document.documentElement,
            document.body,
            ...document.querySelectorAll<HTMLElement>('.page-scroll, .page-container'),
          ].every((el) => el.scrollWidth <= el.clientWidth + 1),
        ),
      { message: `${name}: sin desbordamiento horizontal` },
    )
    .toBe(true);
  const small = await page
    .locator(
      'button:visible, ion-button:visible, summary:visible, input:not([type="checkbox"]):visible, select:visible',
    )
    .evaluateAll((elements) =>
      elements
        .filter((el) => el.getBoundingClientRect().height < 43)
        .map((el) => `${el.tagName}:${el.getAttribute('aria-label') ?? el.textContent?.trim()}`),
    );
  expect(small, `${name}: controles táctiles de al menos 44 px`).toEqual([]);
  await page.screenshot({ path: info.outputPath(`${name}.png`), scale: 'css' });
}
async function login(page: Page, role: string): Promise<void> {
  await expect(page.getByLabel('Correo electrónico')).toHaveClass(/ng-pristine/);
  await page.getByLabel('Correo electrónico').fill(`${role.toLowerCase()}@mobile.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env['SITCAMA_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu espacio de trabajo' })).toBeVisible();
}
async function navigate(page: Page, path: string): Promise<void> {
  await page.locator(`a[href="/app/${path}"]:visible`).first().click();
  await expect(page.locator(`app-${path}`)).toBeVisible();
  await page.locator('.page-scroll').evaluate((el) => {
    el.scrollTop = 0;
  });
}
test('recorrido visual y de teclado con API real a cada ancho', async ({ page, request }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByLabel('Correo electrónico')).toHaveClass(/ng-pristine/);
  if (page.viewportSize()!.width < 1024) {
    const brand = (await page.locator('.login-mobile-brand').boundingBox())!;
    const badge = (await page.locator('.login-version').boundingBox())!;
    expect(brand.x + brand.width + 8).toBeLessThanOrEqual(badge.x);
  }
  await capture(page, info, '01-login');
  await page.getByLabel('Correo electrónico').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Mostrar contraseña' })).toBeFocused();
  await login(page, 'MEDICO');
  const width = page.viewportSize()!.width;
  await expect(page.locator('.sidebar')).toBeVisible({ visible: width >= 1024 });
  await expect(page.getByRole('navigation', { name: 'Navegación móvil', exact: true })).toBeVisible({
    visible: width < 1024,
  });
  await page.getByRole('link', { name: 'Saltar al contenido' }).focus();
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await capture(page, info, '02-inicio');
  await navigate(page, 'register');
  await expect(page.locator('input[formControlName="document"]')).toHaveClass(/ng-pristine/);
  await page.getByRole('button', { name: 'Registrar y consultar resultado' }).click();
  await expect(page.locator('#document-help')).toContainText('Ingresa');
  await page.locator('.page-scroll').evaluate((el) => {
    el.scrollTop = 0;
  });
  await capture(page, info, '03-registro');
  const document = `DEMO-VIS-${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  await page.getByLabel('Documento exacto', { exact: true }).fill(document);
  await page.getByLabel('Nombre completo sintético').fill('Persona ficticia de revisión visual');
  await page.getByLabel('Motivo de consulta sintético').fill('Caso ficticio para comprobar la presentación');
  await page.getByLabel('SpO₂ (%)').fill('84');
  await page.getByLabel('Escala de Glasgow').fill('15');
  await page.getByLabel('Dolor · EVA').fill('1');
  await page.getByRole('button', { name: 'Registrar y consultar resultado' }).click();
  await expect(page.getByRole('heading', { name: 'Paciente sintético registrado' })).toBeVisible();
  await capture(page, info, '04-registro-confirmado');
  await navigate(page, 'search');
  await expect(page.getByLabel('Documento exacto')).toHaveClass(/ng-pristine/);
  await page.getByLabel('Documento exacto').fill(document);
  await page.getByRole('button', { name: 'Buscar paciente', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Registro encontrado' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Persona ficticia');
  await page.locator('.page-scroll').evaluate((el) => {
    el.scrollTop = 0;
  });
  await capture(page, info, '05-busqueda');
  await navigate(page, 'beds');
  await expect(page.getByTestId('bed-card')).toHaveCount(38);
  await expect(page.getByRole('list', { name: 'Leyenda de estados' }).locator('li')).toHaveCount(4);
  await capture(page, info, '06-camas');
  await page.locator('.bed-card.available .bed-action').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture(page, info, '07-confirmacion-cama');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, 'panel');
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toBeVisible();
  const nurse = await request.post('http://localhost:3101/api/auth/login', {
    data: { email: 'enfermero@mobile.test', password: process.env['SITCAMA_E2E_PASSWORD']! },
  });
  const token = (await nurse.json()).access_token;
  const registered = await request.post('http://localhost:3101/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      document: `DEMO-${randomUUID().replaceAll('-', '')}`,
      fullName: 'Persona ficticia de aviso visual',
      triage: {
        chiefComplaint: 'Motivo ficticio',
        spo2: 84,
        glasgow: 15,
        eva: 1,
        paroInminente: false,
        dolorToracicoTipico: false,
      },
    },
  });
  expect(registered.status()).toBe(201);
  await expect(page.getByRole('alert')).toContainText('Nuevo triaje I');
  await capture(page, info, '08-panel-medico');
  await page.locator('.triage-card').first().scrollIntoViewIfNeeded();
  await capture(page, info, '09-prioridades');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login(page, 'AUDITOR');
  await navigate(page, 'audit');
  await expect(page.locator('.audit-event').first()).toBeVisible();
  await expect(page.locator('app-filter-disclosure details')).toHaveJSProperty('open', width >= 1024);
  expect((await page.locator('app-filter-disclosure').boundingBox())!.height).toBeLessThan(width >= 1024 ? 270 : 90);
  if (width < 768) expect((await page.locator('.audit-event').first().boundingBox())!.height).toBeLessThan(320);
  await capture(page, info, '10-auditoria');
  if (width < 1024) {
    await page.locator('app-filter-disclosure summary').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('app-filter-disclosure details')).toHaveJSProperty('open', true);
  }
  await expect(page.getByLabel('Acción', { exact: true })).toBeVisible();
  await capture(page, info, '11-filtros-auditoria');
  expect(
    await page.evaluate(() => Object.values(localStorage).concat(Object.values(sessionStorage)).join(' ')),
  ).not.toMatch(/access_token|patientId|DEMO-|Persona ficticia/);
  expect(errors).toEqual([]);
});
