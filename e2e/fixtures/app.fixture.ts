import { expect, test as base, type Locator, type Page } from '@playwright/test'

type AppFixtures = {
  appPage: Page
  completeOnboarding: (page?: Page) => Promise<void>
  addMovement: (kind: 'Gasto' | 'Ingreso', amount: string, description: string, page?: Page) => Promise<void>
  assertResponsivePage: (page?: Page) => Promise<void>
}

async function onboarding(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Tu plata/i })).toBeVisible()
  await page.getByLabel('Nombre de la cuenta').fill('Cuenta diaria')
  await page.getByLabel('Saldo inicial').fill('100000')
  await page.getByRole('button', { name: 'Empezar a ordenar mi plata' }).click()
  await expect(page.getByText('La billetera no miente.')).toBeVisible()
}

async function movement(page: Page, kind: 'Gasto' | 'Ingreso', amount: string, description: string) {
  const mobile = (page.viewportSize()?.width ?? 0) < 1040
  const trigger = mobile
    ? page.getByTestId('mobile-navigation').getByRole('button', { name: 'Nuevo movimiento' })
    : page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first()
  await trigger.click()
  await page.getByRole('tab', { name: kind, exact: true }).click()
  await page.getByLabel('Importe').fill(amount)
  if (kind === 'Gasto') {
    await page.getByLabel('Categoría').click()
    await page.getByRole('option', { name: 'Supermercado', exact: true }).click()
  }
  await page.getByLabel('Descripción o comercio').fill(description)
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo movimiento' })).toBeHidden()
}

async function isInsideViewport(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) return false
  const viewport = locator.page().viewportSize()
  return Boolean(viewport && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
}

export const test = base.extend<AppFixtures>({
  appPage: async ({ page }, use) => {
    const browserErrors: string[] = []
    page.on('pageerror', error => browserErrors.push(error.message))
    await use(page)
    expect(browserErrors, 'La página no debe generar errores de JavaScript').toEqual([])
  },
  completeOnboarding: async ({ appPage }, use) => {
    await use(async (page = appPage) => onboarding(page))
  },
  addMovement: async ({ appPage }, use) => {
    await use(async (kind, amount, description, page = appPage) => movement(page, kind, amount, description))
  },
  assertResponsivePage: async ({ appPage }, use) => {
    await use(async (page = appPage) => {
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }))
      expect(Math.max(dimensions.body, dimensions.document), 'No debe existir overflow horizontal').toBeLessThanOrEqual(dimensions.viewport + 1)

      const viewport = page.viewportSize()
      if (!viewport || viewport.width >= 1040) return

      const undersizedTargets = await page.locator('button:visible, [role="button"]:visible').evaluateAll(elements => elements
        .map(element => {
          const rect = element.getBoundingClientRect()
          return { label: element.getAttribute('aria-label') || element.textContent?.trim(), width: rect.width, height: rect.height }
        })
        .filter(({ width, height }) => width < 43.5 || height < 43.5))
      expect(undersizedTargets, 'Los controles táctiles deben medir al menos 44×44 px').toEqual([])

      const navigation = page.getByTestId('mobile-navigation')
      if (!await navigation.count()) return
      await expect(navigation).toBeVisible()
      expect(await isInsideViewport(navigation), 'La navegación móvil debe quedar dentro del viewport').toBe(true)

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const navBox = await navigation.boundingBox()
      const lastContentBox = await page.locator('#main-content > :not(header)').last().boundingBox()
      if (navBox && lastContentBox) {
        expect(lastContentBox.y + lastContentBox.height, 'El último bloque no debe quedar cubierto por la navegación').toBeLessThanOrEqual(navBox.y - 8)
      }

    })
  },
})

export { expect }
