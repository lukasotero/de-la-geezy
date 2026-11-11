import { test, expect } from './fixtures/app.fixture'
import { chooseSelect } from './helpers/select'

const screenshot = async (page: import('@playwright/test').Page, name: string) => {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 10_000 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot(name, { animations: 'disabled' })
}

test.describe('referencias visuales por pantalla', () => {
  test('onboarding', async ({ appPage: page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Tu plata/i })).toBeVisible()
    await screenshot(page, '01-onboarding.png')
  })

  test('modal de movimiento', async ({ appPage: page, completeOnboarding }) => {
    await completeOnboarding()
    await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Nuevo movimiento' })).toBeVisible()
    await screenshot(page, '02-modal-movimiento.png')
  })

  test('dashboard con datos', async ({ appPage: page, completeOnboarding, addMovement }) => {
    await completeOnboarding()
    await addMovement('Gasto', '12500', 'Supermercado del barrio')
    await addMovement('Ingreso', '50000', 'Cobro de prueba')
    await screenshot(page, '03-dashboard.png')
  })

  test('movimientos', async ({ appPage: page, completeOnboarding, addMovement }) => {
    await completeOnboarding()
    await addMovement('Gasto', '12500', 'Supermercado del barrio')
    await addMovement('Ingreso', '50000', 'Cobro de prueba')
    await page.getByRole('button', { name: 'Movimientos' }).first().click()
    await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible()
    await screenshot(page, '04-movimientos.png')
  })

  test('cuentas y tarjetas', async ({ appPage: page, completeOnboarding }) => {
    await completeOnboarding()
    await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()
    await expect(page.getByRole('heading', { name: 'Cuentas y tarjetas' })).toBeVisible()
    await page.getByRole('button', { name: 'Nueva tarjeta' }).click()
    await page.getByLabel('Nombre de la tarjeta').fill('Platinum')
    await page.getByLabel('Banco o emisor').fill('Banco Río')
    await chooseSelect(page, 'Marca', 'Visa')
    await page.getByLabel('Últimos 4 números (opcional)').fill('4242')
    await page.getByLabel('Día de cierre (opcional)').fill('20')
    await page.getByLabel('Día de vencimiento (opcional)').fill('5')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByTestId('credit-card-visual')).toBeVisible()
    await screenshot(page, '05-cuentas.png')
  })

  test('análisis', async ({ appPage: page, completeOnboarding, addMovement }) => {
    await completeOnboarding()
    await addMovement('Gasto', '12500', 'Supermercado del barrio')
    await page.getByRole('button', { name: 'Ver análisis' }).click()
    await expect(page.getByRole('heading', { name: 'Entender para decidir.' })).toBeVisible()
    await screenshot(page, '06-analisis.png')
  })

  test('más herramientas', async ({ appPage: page, completeOnboarding }) => {
    await completeOnboarding()
    await page.getByRole('button', { name: 'Más' }).first().click()
    if (await page.getByRole('heading', { name: 'Más', exact: true }).isVisible()) await page.getByRole('button', { name: /^Herramientas/ }).click()
    await expect(page.getByRole('heading', { name: 'Más herramientas' })).toBeVisible()
    await screenshot(page, '07-configuracion.png')
  })
})
