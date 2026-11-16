import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const api = 'http://localhost:3101/api';
async function login(page: Page, role: 'MEDICO' | 'SERVICIOS') {
  await page.goto('/');
  await expect(page.getByLabel('Correo electrónico')).toHaveClass(/ng-pristine/);
  await page.getByLabel('Correo electrónico').fill(`${role.toLowerCase()}@mobile.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env['SITCAMA_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu espacio de trabajo' })).toBeVisible();
  await page.locator('a[href="/app/beds"]:visible').first().click();
  await expect(page.getByTestId('bed-card')).toHaveCount(38);
}
async function patient(request: APIRequestContext, pending = false) {
  const login = await request.post(`${api}/auth/login`, {
    data: { email: 'medico@mobile.test', password: process.env['SITCAMA_E2E_PASSWORD'] },
  });
  expect(login.status()).toBe(200);
  const token = (await login.json()).access_token;
  const document = `BED-${randomUUID().replaceAll('-', '')}`;
  const registered = await request.post(`${api}/patients`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      document,
      fullName: 'Persona Ficticia de Camas',
      triage: {
        chiefComplaint: 'Caso académico ficticio',
        spo2: pending ? 98 : 84,
        glasgow: 15,
        eva: 1,
        paroInminente: false,
        dolorToracicoTipico: false,
      },
    },
  });
  expect(registered.status()).toBe(201);
  return { document, patientId: (await registered.json()).patientId as string };
}
function card(page: Page, code: string): Locator {
  return page.getByTestId('bed-card').filter({ has: page.getByRole('heading', { name: code, exact: true }) });
}
async function prepare(page: Page, code: string, document: string) {
  await card(page, code).getByRole('button', { name: 'Asignar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Documento sintético exacto')).toHaveClass(/ng-pristine/);
  await dialog.getByLabel('Documento sintético exacto').fill(document);
  await dialog.getByRole('button', { name: 'Buscar para asignar', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Revisa la asignación' })).toBeVisible();
  return dialog;
}

test('MEDICO asigna/libera y SERVICIOS limpia con confirmaciones y censo real', async ({
  page,
  context,
  request,
}, testInfo) => {
  const created = await patient(request);
  const code = testInfo.project.name === 'Mobile Chrome' ? 'UA-14' : 'UA-12';
  await login(page, 'MEDICO');
  const dialog = await prepare(page, code, created.document);
  await expect(dialog).not.toContainText('Persona Ficticia de Camas');
  await dialog.getByLabel('Servicio solicitado').selectOption('AISLAMIENTO');
  await dialog.getByRole('button', { name: 'Confirmar asignación' }).click();
  await expect(dialog.getByRole('alert')).toContainText('no coincide');
  await dialog.getByLabel('Servicio solicitado').selectOption('URGENCIAS_ADULTOS');
  await page.screenshot({ path: testInfo.outputPath('confirmar-asignacion.png'), scale: 'css' });
  await dialog.getByRole('button', { name: 'Confirmar asignación' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(card(page, code)).toContainText('Ocupada');
  const services = await context.newPage();
  await login(services, 'SERVICIOS');
  await expect(services.getByRole('button', { name: 'Asignar', exact: true })).toHaveCount(0);
  await expect(services.getByRole('button', { name: 'Liberar', exact: true })).toHaveCount(0);
  await expect(services.locator('main')).not.toContainText(created.patientId);
  await card(page, code).getByRole('button', { name: 'Liberar', exact: true }).click();
  await expect(dialog).toContainText(created.patientId);
  await dialog.getByRole('button', { name: 'Confirmar liberación', exact: true }).click();
  await expect(card(page, code)).toContainText('En limpieza');
  await services.getByRole('button', { name: 'Actualizar censo', exact: true }).click();
  await expect(card(services, code)).toContainText('En limpieza');
  await card(services, code).getByRole('button', { name: 'Completar limpieza', exact: true }).click();
  const cleaning = services.getByRole('dialog');
  await expect(cleaning.getByRole('heading', { name: 'Confirmar limpieza', exact: true })).toBeVisible();
  await services.screenshot({ path: testInfo.outputPath('confirmar-limpieza.png'), scale: 'css' });
  await cleaning.getByRole('button', { name: 'Confirmar limpieza', exact: true }).click();
  await expect(cleaning).not.toBeVisible();
  await expect(card(services, code)).toContainText('Disponible');
  await expect(services.getByRole('status').filter({ hasText: 'Limpieza confirmada' })).toBeVisible();
  expect(await services.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await services.close();
});
test('revisión obsoleta recibe 409 y no permite repetir una asignación', async ({
  page,
  context,
  request,
}, testInfo) => {
  const first = await patient(request);
  const second = await patient(request);
  const code = testInfo.project.name === 'Mobile Chrome' ? 'UA-15' : 'UA-11';
  await login(page, 'MEDICO');
  const other = await context.newPage();
  await login(other, 'MEDICO');
  const winner = await prepare(page, code, first.document);
  const loser = await prepare(other, code, second.document);
  await winner.getByRole('button', { name: 'Confirmar asignación' }).click();
  await expect(card(page, code)).toContainText('Ocupada');
  await loser.getByRole('button', { name: 'Confirmar asignación' }).click();
  await expect(loser.getByRole('alert')).toContainText('No se puede asignar');
  await expect(loser.getByRole('button', { name: 'Confirmar asignación' })).toBeDisabled();
  await loser.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(card(other, code)).toContainText('Ocupada');
  await other.close();
});
test('la interfaz no confirma un caso pendiente de revisión', async ({ page, request }, testInfo) => {
  const created = await patient(request, true);
  await login(page, 'MEDICO');
  const dialog = await prepare(page, testInfo.project.name === 'Mobile Chrome' ? 'UA-13' : 'UA-10', created.document);
  await expect(dialog.getByRole('status')).toContainText('no cumple la restricción I/II');
  await expect(dialog.getByRole('button', { name: 'Confirmar asignación' })).toBeDisabled();
});
