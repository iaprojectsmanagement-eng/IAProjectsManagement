import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('monitor creates a project and sees it in the catalog', async ({ page }) => {
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
  await page.getByLabel('Código único').fill('E2E_PROYECTO');
  await page.getByLabel('Organización').fill('Organización E2E');
  await page.getByLabel('Nombre del proyecto').fill('Proyecto creado por prueba automatizada');
  await page.getByLabel('Descripción del reto').fill('Validar el flujo completo de creación.');
  await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Proyecto creado por prueba automatizada' })).toBeVisible();
});

test('vertical workflow creates issue, meeting, minute, task and exportable document', async ({ page }) => {
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();

  await page.getByRole('button', { name: 'incidencias', exact: true }).click();
  await page.getByRole('button', { name: 'Reportar incidente', exact: true }).click();
  await page.getByLabel('Título').fill('Bloqueo E2E');
  await page.getByLabel('Contexto').fill('No se puede avanzar hasta recibir el acceso de prueba.');
  await page.getByLabel('Categoría').selectOption('datos_accesos');
  await page.getByLabel('Prioridad').selectOption('alta');
  await page.getByRole('button', { name: /Enviar al monitor/ }).click();
  await expect(page.getByRole('heading', { name: 'Bloqueo E2E' })).toBeVisible();

  await page.getByRole('button', { name: 'reuniones', exact: true }).click();
  await page.getByRole('button', { name: 'Programar reunión', exact: true }).click();
  await page.getByLabel('Título').fill('Reunión E2E');
  await page.getByLabel('Agenda').fill('Revisar avances y asignar compromisos.');
  await page.getByRole('button', { name: 'Programar', exact: true }).click();
  const meetingCard = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Reunión E2E' }) });
  await meetingCard.getByRole('button', { name: 'Realizada', exact: true }).click();
  await meetingCard.getByLabel('Contenido').fill('Se decidió aprobar el piloto. El equipo debe entregar el informe de validación. Existe riesgo por falta de acceso.');
  await meetingCard.getByRole('button', { name: 'Generar borrador editable', exact: true }).click();
  await meetingCard.getByRole('button', { name: 'Guardar acta y crear tareas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Actas guardadas' })).toBeVisible();
  await expect(page.getByText(/Acta de reunión —/).first()).toBeVisible();

  await page.getByRole('button', { name: 'tareas', exact: true }).click();
  await expect(page.getByText(/El equipo debe entregar el informe de validación/).first()).toBeVisible();

  await page.getByRole('button', { name: 'documentos', exact: true }).click();
  const generated = page.getByText(/Acta de reunión —/).first();
  await expect(generated).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF', exact: true }).first().click();
  const download = await downloadPromise;
  expect(await download.suggestedFilename()).toMatch(/\.pdf$/);
  const docxDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'DOCX', exact: true }).first().click();
  const docxDownload = await docxDownloadPromise;
  expect(await docxDownload.suggestedFilename()).toMatch(/\.docx$/);
});

test('student remains scoped and does not receive destructive task controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Vista estudiante demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Clasificación de solicitudes/ })).toBeVisible();
  await page.getByRole('button', { name: 'Tareas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tareas del equipo' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Eliminar/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Proyectos', exact: true })).toHaveCount(0);
});

test('mobile navigation exposes every monitor section without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Reportes', exact: true })).toBeAttached();
  await page.getByRole('button', { name: 'Reportes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBe(dimensions.width);
});
