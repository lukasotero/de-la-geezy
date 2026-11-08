import { test, expect } from './fixtures/app.fixture'

test.describe('cobertura responsive integral', () => {
  test('el sidebar de escritorio se colapsa a iconos y vuelve a abrirse', async ({ appPage: page, completeOnboarding }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1040, 'El sidebar sólo existe en escritorio')
    await completeOnboarding()
    const sidebar = page.locator('aside')
    const initialWidth = (await sidebar.boundingBox())?.width ?? 0
    const close = page.getByRole('button', { name: 'Cerrar barra lateral' })
    await expect(close).toHaveAttribute('aria-expanded', 'true')
    await close.click()
    await expect(page.getByRole('button', { name: 'Abrir barra lateral' })).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeLessThan(initialWidth)
    await expect(sidebar.getByText('Cuentas y tarjetas', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Abrir barra lateral' }).click()
    await expect(page.getByRole('button', { name: 'Cerrar barra lateral' })).toHaveAttribute('aria-expanded', 'true')
    await expect(sidebar.getByText('Cuentas y tarjetas', { exact: true })).toBeVisible()
  })

  test('onboarding se adapta al viewport', async ({ appPage: page, assertResponsivePage }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Tu plata/i })).toBeVisible()
    await assertResponsivePage()
  })

  test('todas las vistas permanecen utilizables y sin solapamientos', async ({ appPage: page, completeOnboarding, addMovement, assertResponsivePage }) => {
    await completeOnboarding()
    await addMovement('Gasto', '12500', 'Supermercado del barrio con una descripción extensa')
    await addMovement('Ingreso', '50000', 'Cobro de prueba')

    await assertResponsivePage()

    const movementsNav = (page.viewportSize()?.width ?? 0) < 1040
      ? page.getByTestId('mobile-navigation').getByRole('button', { name: 'Movimientos' })
      : page.getByRole('button', { name: 'Movimientos' }).first()
    await movementsNav.click()
    await expect(page.getByRole('heading', { name: 'Movimientos' })).toBeVisible()
    await assertResponsivePage()

    await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()
    await expect(page.getByRole('heading', { name: 'Cuentas y tarjetas' })).toBeVisible()
    await assertResponsivePage()

    await page.getByRole('button', { name: 'Inicio' }).first().click()
    await page.getByRole('button', { name: 'Ver análisis' }).click()
    await expect(page.getByRole('heading', { name: 'Entender para decidir.' })).toBeVisible()
    await assertResponsivePage()

    await page.getByRole('button', { name: 'Más' }).first().click()
    if ((page.viewportSize()?.width ?? 0) < 1040) {
      await expect(page.getByRole('heading', { name: 'Más', exact: true })).toBeVisible()
      await page.getByRole('button', { name: /^Categorías/ }).click()
      await expect(page.getByRole('heading', { name: 'Categorías', exact: true })).toBeVisible()
      await assertResponsivePage()
      await page.getByRole('button', { name: 'Más', exact: true }).first().click()
      await page.getByRole('button', { name: /^Herramientas/ }).click()
    }
    await expect(page.getByRole('heading', { name: 'Más herramientas' })).toBeVisible()
    await assertResponsivePage()
  })

  test('los overlays principales caben, desplazan contenido y conservan el foco', async ({ appPage: page, completeOnboarding, assertResponsivePage }) => {
    await completeOnboarding()
    const trigger = page.getByRole('button', { name: /Nuevo movimiento/i }).first()
    await trigger.focus()
    await trigger.click()
    await expect(page.getByRole('heading', { name: 'Nuevo movimiento' })).toBeVisible()
    await assertResponsivePage()
    for (const tab of ['Gasto', 'Ingreso', 'Transferencia']) {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true')
    }
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()

    await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()
    await page.getByRole('button', { name: 'Nueva cuenta' }).click()
    await expect(page.getByRole('heading', { name: 'Nueva cuenta' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Nueva tarjeta' }).click()
    await expect(page.getByRole('heading', { name: 'Nueva tarjeta' })).toBeVisible()
  })
})
