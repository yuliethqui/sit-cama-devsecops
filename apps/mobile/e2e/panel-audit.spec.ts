import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function login(page: Page, role: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByLabel('Correo electrónico')).toHaveClass(/ng-pristine/);
  await page.getByLabel('Correo electrónico').fill(`${role.toLowerCase()}@mobile.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env['SITCAMA_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu espacio de trabajo' })).toBeVisible();
}
async function nurseToken(request: APIRequestContext): Promise<string> {
  const response = await request.post('http://localhost:3101/api/auth/login', {
    data: {
      email: 'enfermero@mobile.test',
      password: process.env['SITCAMA_E2E_PASSWORD']!,
    },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).access_token;
}
async function register(request: APIRequestContext, token: string, critical = true): Promise<string> {
  const response = await request.post('http://localhost:3101/api/patients', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      document: `DEMO-${randomUUID().replaceAll('-', '')}`,
      fullName: 'SENTINEL_IDENTIDAD_PRIVADA',
      triage: {
        chiefComplaint: 'SENTINEL_MOTIVO_PRIVADO',
        spo2: critical ? 84 : 98,
        glasgow: 15,
        eva: 1,
        paroInminente: false,
        dolorToracicoTipico: false,
      },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).patientId;
}
test('panel recibe aviso real, recupera tras desconexión y reapertura sin duplicar', async ({
  page,
  request,
}, info) => {
  const token = await nurseToken(request);
  await login(page, 'MEDICO');
  await page.locator('a[href="/app/panel"]:visible').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toBeVisible();
  const patient = await register(request, token);
  await expect(page.getByRole('alert')).toContainText('Nuevo triaje I');
  await expect(page.locator(`[data-patient="${patient}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-patient="${patient}"]`)).toHaveClass(/priority-one/);
  await expect(page.locator('main')).not.toContainText('SENTINEL');
  await page.context().setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: /Desconectado|Reconectando|Sin conexión/ })).toBeVisible();
  const pending = await register(request, token, false);
  await page.context().setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toBeVisible();
  // Totals recover even if pagination places a pending case on a later page.
  await expect(page.locator('app-panel')).toContainText('Revisión pendiente');
  await page.locator('a[href="/app/home"]:visible').first().click();
  await page.locator('a[href="/app/panel"]:visible').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toBeVisible();
  await expect(page.locator(`[data-patient="${patient}"]`)).toHaveCount(1);
  expect(pending).not.toBe(patient);
  const ids = await page
    .locator('[data-patient]')
    .evaluateAll((elements) => elements.map((el) => el.getAttribute('data-patient')));
  expect(new Set(ids).size).toBe(ids.length);
  expect(
    await page.evaluate(() => Object.values(localStorage).concat(Object.values(sessionStorage)).join(' ')),
  ).not.toMatch(/access_token|patientId|SENTINEL/);
  await page.screenshot({ path: info.outputPath('panel-medico.png'), scale: 'css' });
});

test('auditor filtra eventos reales, pagina y muestra vacío sin detalles sensibles', async ({
  page,
  request,
}, info) => {
  const token = await nurseToken(request);
  for (let i = 0; i < 27; i++) await register(request, token, false);
  await login(page, 'AUDITOR');
  await page.locator('a[href="/app/audit"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Consulta de auditoría' })).toBeVisible();
  if (!(await page.locator('app-filter-disclosure details').evaluate((el) => (el as HTMLDetailsElement).open))) {
    await page.locator('app-filter-disclosure summary').click();
  }
  await expect(page.locator('select[formControlName="action"]')).toHaveClass(/ng-pristine/);
  await page.getByLabel('Acción', { exact: true }).selectOption('RECORD_TRIAGE');
  const firstResponse = page.waitForResponse(
    (response) => response.url().includes('/audit/events?') && response.url().includes('action=RECORD_TRIAGE'),
  );
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  const firstData = await (await firstResponse).json();
  await expect(page.locator('.audit-event .eyebrow')).toHaveText(
    firstData.items.map((item: { id: string }) => `EVENTO ${item.id}`),
  );
  await expect(page.locator('.audit-event')).toHaveCount(25);
  await expect(page.locator('main')).not.toContainText('SENTINEL');
  const first = await page.locator('.audit-event .eyebrow').allTextContents();
  const secondResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/audit/events?`) && response.url().includes(`cursor=${firstData.nextCursor}`),
  );
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  const secondData = await (await secondResponse).json();
  await expect(page.locator('.audit-event .eyebrow')).toHaveText(
    secondData.items.map((item: { id: string }) => `EVENTO ${item.id}`),
  );
  await expect(page.getByText(/Página 2/)).toBeVisible();
  await expect(page.locator('.audit-event').first()).toBeVisible();
  const second = await page.locator('.audit-event .eyebrow').allTextContents();
  expect(second.some((id) => first.includes(id))).toBe(false);
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(page.getByText(/Página 1/)).toBeVisible();
  await page.getByLabel('Actor · UUID').fill(randomUUID());
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByRole('heading', { name: 'Sin eventos para estos filtros' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('.audit-event').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('auditoria.png'), scale: 'css' });
});

test('SERVICIOS carece de acceso al panel y a auditoría', async ({ page, request }) => {
  await login(page, 'SERVICIOS');
  await expect(page.locator('a[href="/app/panel"]')).toHaveCount(0);
  await expect(page.locator('a[href="/app/audit"]')).toHaveCount(0);
  const response = await request.post('http://localhost:3101/api/auth/login', {
    data: {
      email: 'servicios@mobile.test',
      password: process.env['SITCAMA_E2E_PASSWORD']!,
    },
  });
  const token = (await response.json()).access_token;
  for (const path of ['/triage/panel', '/audit/events']) {
    const denied = await request.get(`http://localhost:3101/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(denied.status()).toBe(403);
    expect(await denied.text()).not.toMatch(/patientId|actorId|SENTINEL/);
  }
});
