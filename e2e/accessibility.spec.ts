import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures/app.fixture'

test('las pantallas principales no tienen infracciones WCAG A/AA críticas o serias', async ({ appPage: page, completeOnboarding }) => {
  await completeOnboarding()
  for (const view of ['Inicio', 'Movimientos', 'Cuentas y tarjetas', 'Más']) {
    await page.getByRole('button', { name: view, exact: true }).first().click()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    const blocking = results.violations.filter(violation => violation.impact === 'critical' || violation.impact === 'serious')
    expect(blocking, `${view}: ${blocking.map(item => `${item.id}: ${item.help}`).join('; ')}`).toEqual([])
  }
})

test('los diálogos de corrección de tarjeta son accesibles y restauran el foco', async ({ appPage: page, completeOnboarding }) => {
  await completeOnboarding()
  await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()
  await page.getByRole('button', { name: 'Nueva tarjeta' }).click()
  await page.getByLabel('Nombre de la tarjeta').fill('Visa accesible')
  await page.getByLabel('Banco o emisor').fill('Banco')
  await page.getByLabel('Día de cierre (opcional)').fill('25')
  await page.getByLabel('Día de vencimiento (opcional)').fill('10')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.getByRole('button', { name: 'Más' }).first().click()
  if (await page.getByRole('heading', { name: 'Más', exact: true }).isVisible()) await page.getByRole('button', { name: /^Herramientas/ }).click()
  const panel = page.getByRole('heading', { name: 'Compras y resúmenes' }).locator('..').locator('..')
  await panel.getByLabel('Comercio o concepto').fill('Compra accesible')
  await panel.getByLabel('Importe', { exact: true }).first().fill('100')
  await panel.getByRole('button', { name: 'Registrar compra' }).click()

  for (const action of ['Editar compra', 'Anular compra']) {
    const trigger = panel.getByRole('button', { name: new RegExp(`^${action}`) })
    await trigger.focus(); await trigger.click()
    const dialog = page.getByRole('dialog', { name: action })
    await expect(dialog).toBeVisible()
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
    expect(results.violations.filter(item => item.impact === 'critical' || item.impact === 'serious')).toEqual([])
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  }
})

test('las acciones compactas usan tooltips accesibles y no title nativo', async ({ appPage: page, completeOnboarding }) => {
  await completeOnboarding()
  await page.getByRole('button', { name: 'Movimientos', exact: true }).first().click()
  const filter = page.getByRole('button', { name: /^Filtrar(?:,|$)/ })
  await filter.focus()
  await expect(page.getByRole('tooltip', { name: 'Filtrar' })).toBeVisible()
  await expect(page.locator('[title]')).toHaveCount(0)
})

test('respeta la preferencia de movimiento reducido', async ({ appPage: page, completeOnboarding }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await completeOnboarding()
  await page.getByRole('button', { name: 'Movimientos', exact: true }).first().click()

  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  await page.getByRole('button', { name: /^Filtrar(?:,|$)/ }).click()
  await expect(page.locator('#movement-filters')).toBeVisible()
  await page.getByRole('button', { name: /^Filtrar(?:,|$)/ }).click()
  await expect(page.locator('#movement-filters')).toHaveCount(0)

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  expect(results.violations.filter(item => item.impact === 'critical' || item.impact === 'serious')).toEqual([])
})
