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

test('monitor workflows use modal forms and custom selectors', async ({ page }) => {
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page.locator('section[role="button"]').first().click();

  await page.getByRole('button', { name: 'incidencias', exact: true }).click();
  await page.getByRole('button', { name: 'Reportar incidente', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Reportar incidente' })).toBeVisible();
  await page.getByLabel('Título').fill('Bloqueo E2E');
  await page.getByLabel('Contexto').fill('No se puede avanzar hasta recibir el acceso de prueba.');
  await page.getByRole('button', { name: 'Categoría' }).click();
  await page.getByRole('option', { name: 'Datos o accesos' }).click();
  await page.getByRole('button', { name: 'Prioridad' }).click();
  await page.getByRole('option', { name: 'Alta' }).click();
  await page.getByRole('button', { name: /Enviar al monitor/ }).click();
  await expect(page.getByRole('heading', { name: 'Bloqueo E2E' })).toBeVisible();

  await page.getByRole('button', { name: 'tareas', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva tarea', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Nueva tarea' })).toBeVisible();
  await page.getByLabel('Título').fill('Tarea E2E');
  await page.getByLabel('Descripción').fill('Tarea creada mediante el modal.');
  await page.getByRole('button', { name: 'Prioridad' }).click();
  await page.getByRole('option', { name: 'Alta' }).click();
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  await expect(page.getByText('Tarea E2E', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar realizada', exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'reuniones', exact: true }).click();
  await page.getByRole('button', { name: 'Programar reunión', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Programar reunión' })).toBeVisible();
  const meetingDialog = page.getByRole('dialog', { name: 'Programar reunión' });
  await meetingDialog.getByLabel('Título').fill('Reunión E2E');
  await meetingDialog.getByRole('textbox', { name: 'Agenda' }).fill('Revisar avances y asignar compromisos.');
  await meetingDialog.getByRole('button', { name: 'Programar', exact: true }).click();
  await expect(page.getByText('Reunión E2E', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'documentos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Documentos generados', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Crear documento institucional', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Crear documento institucional' })).toBeVisible();
  await expect(page.getByText('Información adicional', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
});

test('student remains scoped and does not receive destructive task controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Vista estudiante demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Clasificación de solicitudes/ })).toBeVisible();
  await page.getByRole('button', { name: 'Tareas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nueva tarea', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Eliminar/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Proyectos', exact: true })).toHaveCount(0);
});

test('mobile navigation exposes every monitor section without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Reportes', exact: true })).toBeAttached();
  await page.getByRole('button', { name: 'Reportes', exact: true }).click();
  await expect(page.getByPlaceholder('Buscar proyecto por nombre, código o empresa')).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBe(dimensions.width);
});
