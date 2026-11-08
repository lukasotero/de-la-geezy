import { expect, test } from './fixtures/app.fixture'

async function openTools(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Más', exact: true }).first().click()
  if (await page.getByRole('heading', { name: 'Más', exact: true }).isVisible()) await page.getByRole('button', { name: /^Herramientas/ }).click()
  await expect(page.getByRole('heading', { name: 'Más herramientas' })).toBeVisible()
}

test('exporta, permite cancelar y restaura un respaldo desde el inicio', async ({ appPage: page, browser, completeOnboarding }) => {
  await completeOnboarding()
  await openTools(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar respaldo' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^de-la-geezy-respaldo-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await download.path()
  expect(path).toBeTruthy()

  await page.getByLabel('Seleccionar archivo de respaldo').setInputFiles(path!)
  await expect(page.getByRole('alertdialog')).toContainText('Los datos actuales de este navegador serán reemplazados')
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('alertdialog')).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Más herramientas' })).toBeVisible()

  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', locale: 'es-AR' })
  const freshPage = await context.newPage()
  await freshPage.goto('/')
  await expect(freshPage.getByRole('heading', { name: /Tu plata/i })).toBeVisible()
  await freshPage.getByLabel('Seleccionar archivo de respaldo').setInputFiles(path!)
  await freshPage.getByRole('button', { name: 'Restaurar respaldo' }).click()
  await expect(freshPage.getByText('La billetera no miente.')).toBeVisible()
  await context.close()
})
