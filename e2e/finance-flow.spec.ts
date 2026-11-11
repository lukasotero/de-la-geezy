import { expect, test } from '@playwright/test'
import { chooseSelect } from './helpers/select'

function mercadoPagoPdfFixture(): Buffer {
  const text = [
    'BT /F1 8 Tf 1 0 0 1 20 600 Tm (mercado pago) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 250 590 Tm (RESUMEN DE CUENTA EN PESOS) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 250 560 Tm (Periodo:) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 290 560 Tm (Del 1 al 30 de septiembre de 2026) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 40 442 Tm (Fecha) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 89 442 Tm (Descripci\\363n) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 197 445 Tm (ID de la) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 312 442 Tm (Valor) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 383 442 Tm (Saldo) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 40 412 Tm (01-09-2026) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 89 412 Tm (Pago Sube viajes) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 197 412 Tm (176649482542) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 290 412 Tm ($ -1.002,80) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 355 412 Tm ($ 10.000,00) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 40 380 Tm (02-09-2026) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 89 380 Tm (Transferencia enviada Ana) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 197 380 Tm (176649482543) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 290 380 Tm ($ -500,00) Tj ET',
    'BT /F1 8 Tf 1 0 0 1 355 380 Tm ($ 9.500,00) Tj ET',
  ].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 446 632] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(text, 'latin1')} >>\nstream\n${text}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

async function completeOnboarding(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Tu plata/i })).toBeVisible()
  await page.getByLabel('Nombre de la cuenta').fill('Cuenta diaria')
  await page.getByLabel('Saldo inicial').fill('100000')
  await page.getByRole('button', { name: 'Empezar a ordenar mi plata' }).click()
  await expect(page.getByText('La billetera no miente.')).toBeVisible()
}

async function openTools(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Más', exact: true }).first().click()
  const menuHeading = page.getByRole('heading', { name: 'Más', exact: true })
  if (await menuHeading.isVisible()) await page.getByRole('button', { name: /^Herramientas/ }).click()
  await expect(page.getByRole('heading', { name: 'Más herramientas' })).toBeVisible()
}

async function openCategories(page: import('@playwright/test').Page) {
  const desktopEntry = page.getByRole('button', { name: 'Categorías', exact: true }).first()
  if (await desktopEntry.isVisible()) await desktopEntry.click()
  else {
    await page.getByRole('button', { name: 'Más', exact: true }).first().click()
    await page.getByRole('button', { name: /^Categorías/ }).click()
  }
  await expect(page.getByRole('heading', { name: 'Categorías', exact: true })).toBeVisible()
}

async function expectedCardCycleLabels(page: import('@playwright/test').Page, closingDay: number, dueDay: number) {
  return page.evaluate(({ closingDay, dueDay }) => {
    const dateForDay = (year: number, month: number, day: number) => {
      const lastDay = new Date(year, month + 1, 0, 12).getDate()
      return new Date(year, month, Math.min(day, lastDay), 12)
    }
    const addMonths = (date: Date, months: number, day: number) => {
      const target = new Date(date.getFullYear(), date.getMonth() + months, 1, 12)
      return dateForDay(target.getFullYear(), target.getMonth(), day)
    }
    const today = new Date()
    const civilToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
    const closingThisMonth = dateForDay(civilToday.getFullYear(), civilToday.getMonth(), closingDay)
    let closingDate = civilToday >= closingThisMonth ? closingThisMonth : addMonths(closingThisMonth, -1, closingDay)
    let dueDate = addMonths(closingDate, dueDay <= closingDay ? 1 : 0, dueDay)
    if (civilToday > dueDate) {
      closingDate = addMonths(closingDate, 1, closingDay)
      dueDate = addMonths(closingDate, dueDay <= closingDay ? 1 : 0, dueDay)
    }
    const format = (date: Date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
    return { closing: format(closingDate), due: format(dueDate) }
  }, { closingDay, dueDay })
}

test('onboarding y gasto actualizan los indicadores reales', async ({ page }) => {
  await completeOnboarding(page)

  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByRole('tab', { name: 'Gasto', exact: true }).click()
  await page.getByPlaceholder('0').fill('12500')
  await chooseSelect(page, 'Categoría', 'Supermercado')
  await page.getByLabel('Descripción o comercio').fill('Supermercado del barrio')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()

  await expect(page.getByText('$ 12.500', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Movimientos' }).first().click()
  await page.getByRole('button', { name: 'Editar movimiento Supermercado del barrio' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Categoría')).toContainText('Supermercado')
})

test('un gasto USD usa su cotización histórica en Inicio y Análisis', async ({ page }) => {
  await page.route('https://dolarapi.com/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ venta: 1450, fechaActualizacion: '2026-11-04T12:00:00.000Z' }),
  }))
  await completeOnboarding(page)
  await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()
  await page.getByRole('button', { name: 'Nueva cuenta' }).click()
  await page.getByLabel('Nombre').fill('Cuenta USD')
  await chooseSelect(page, 'Moneda', 'USD')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByLabel('Importe').fill('600')
  await chooseSelect(page, 'Cuenta', /Cuenta USD/)
  await chooseSelect(page, 'Categoría', 'Vivienda')
  await page.getByLabel('Descripción o comercio').fill('Alquiler USD')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()

  await page.getByRole('button', { name: 'Inicio' }).first().click()
  await expect(page.getByText('Gastos', { exact: true }).locator('..')).toContainText('$ 870.000')
  await page.getByRole('button', { name: 'Ver análisis' }).click()
  await expect(page.getByText('Gastos del mes').locator('..')).toContainText('$ 870.000')
  await page.getByRole('button', { name: 'Vivienda' }).click()
  await expect(page.getByText('USD 600', { exact: false })).toBeVisible()
  await expect(page.getByText('$ 870.000 histórico', { exact: false })).toBeVisible()
})

test('el movimiento persiste después de recargar', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByRole('tab', { name: 'Ingreso', exact: true }).click()
  await page.getByPlaceholder('0').fill('50000')
  await page.getByLabel('Descripción o comercio').fill('Cobro de prueba')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo movimiento' })).toBeHidden()
  await page.reload()

  const movementNav = page.getByRole('button', { name: 'Movimientos' })
  await movementNav.first().click()
  await expect(page.getByText('Cobro de prueba')).toBeVisible()
  await expect(page.getByTestId('movement-amount').filter({ hasText: '50.000' })).toBeVisible()
})

test('permite recategorizar desde el modal y persiste el cambio', async ({ page }) => {
  await completeOnboarding(page)

  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByPlaceholder('0').fill('12500')
  await chooseSelect(page, 'Categoría', 'Supermercado')
  await page.getByLabel('Descripción o comercio').fill('Compra recategorizable')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()

  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByRole('tab', { name: 'Ingreso', exact: true }).click()
  await page.getByPlaceholder('0').fill('50000')
  await page.getByLabel('Descripción o comercio').fill('Ingreso recategorizable')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await page.getByRole('button', { name: 'Movimientos' }).first().click()

  await page.getByRole('button', { name: 'Editar movimiento Compra recategorizable' }).click()
  const editor = page.getByRole('dialog')
  const expenseCategory = editor.getByLabel('Categoría')
  await expenseCategory.click()
  await expect(page.getByRole('option', { name: 'Transporte', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Sueldo', exact: true })).toHaveCount(0)
  await page.getByRole('option', { name: 'Transporte', exact: true }).press('Enter')
  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(expenseCategory).toContainText('Transporte')
  await editor.getByRole('button', { name: 'Guardar' }).click()
  await expect(editor).toBeHidden()

  await page.getByRole('button', { name: 'Editar movimiento Ingreso recategorizable' }).click()
  const incomeCategory = editor.getByLabel('Categoría')
  await incomeCategory.click()
  await expect(page.getByRole('option', { name: 'Sueldo', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Supermercado', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  await page.reload()
  await page.getByRole('button', { name: 'Movimientos' }).first().click()
  await expect(page.getByLabel('Cambiar categoría de Compra recategorizable')).toHaveCount(0)
  await page.getByRole('button', { name: 'Editar movimiento Compra recategorizable' }).click()
  await expect(page.getByRole('dialog').getByLabel('Categoría')).toContainText('Transporte')
})

test('los íconos distinguen ingresos, egresos y transferencias', async ({ page }) => {
  await completeOnboarding(page)

  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByPlaceholder('0').fill('100')
  await page.getByLabel('Descripción o comercio').fill('Egreso visual')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()

  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByRole('tab', { name: 'Ingreso', exact: true }).click()
  await page.getByPlaceholder('0').fill('100')
  await page.getByLabel('Descripción o comercio').fill('Ingreso visual')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()

  await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()
  await page.getByRole('button', { name: 'Nueva cuenta' }).click()
  await page.getByLabel('Nombre').fill('Cuenta destino')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByRole('tab', { name: 'Transferencia', exact: true }).click()
  await page.getByPlaceholder('0').fill('100')
  await chooseSelect(page, 'Cuenta de destino', /Cuenta destino/)
  await page.getByLabel('Descripción o comercio').fill('Transferencia visual')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await page.getByRole('button', { name: 'Movimientos' }).first().click()

  await expect(page.getByTestId('movement-icon').filter({ has: page.locator('svg.lucide-trending-down') })).toHaveClass(/text-danger/)
  await expect(page.getByTestId('movement-icon').filter({ has: page.locator('svg.lucide-trending-up') })).toHaveClass(/text-success/)
  await expect(page.getByTestId('movement-icon').filter({ has: page.locator('svg.lucide-arrow-left-right') })).toHaveClass(/text-muted/)
  await expect(page.getByLabel('Cambiar categoría de Transferencia visual')).toHaveCount(0)
})

test('la navegación principal funciona en el viewport configurado', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()
  await expect(page.getByRole('heading', { name: 'Cuentas y tarjetas' })).toBeVisible()
  await openTools(page)
  await expect(page.getByRole('heading', { name: 'Más herramientas' })).toBeVisible()
})

test('crea y edita una tarjeta sin inventar fechas', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()
  await page.getByRole('button', { name: 'Nueva tarjeta' }).click()
  await page.getByLabel('Nombre de la tarjeta').fill('Platinum')
  await page.getByLabel('Banco o emisor').fill('Banco Río')
  await chooseSelect(page, 'Marca', 'Visa')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  await expect(page.getByTestId('credit-card-visual')).toHaveAttribute('data-card-brand', 'Visa')
  await expect(page.getByText('Cierre: Sin definir')).toBeVisible()
  await expect(page.getByText(/Vencimiento: Sin definir/)).toBeVisible()
  await expect(page.getByText(/Cierre: día 25/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Editar tarjeta Platinum' }).click()
  await page.getByLabel('Últimos 4 números (opcional)').fill('4242')
  await page.getByLabel('Día de cierre (opcional)').fill('20')
  await page.getByLabel('Día de vencimiento (opcional)').fill('5')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  const cycle = await expectedCardCycleLabels(page, 20, 5)
  await expect(page.getByText('•••• 4242')).toBeVisible()
  await expect(page.getByText(`Cierre: ${cycle.closing}`)).toBeVisible()
  await expect(page.getByText(`Vencimiento: ${cycle.due} · ARS`)).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()
  await expect(page.getByText('•••• 4242')).toBeVisible()
  await expect(page.getByText(`Cierre: ${cycle.closing}`)).toBeVisible()
})

test('edita cuentas y protege la moneda cuando ya tienen movimientos', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByLabel('Importe').fill('100')
  await page.getByLabel('Descripción o comercio').fill('Movimiento que protege moneda')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()

  await page.getByRole('button', { name: 'Editar cuenta Cuenta diaria' }).click()
  await expect(page.getByLabel('Moneda')).toBeDisabled()
  await expect(page.getByText(/La moneda no se puede cambiar porque esta cuenta ya tiene movimientos/)).toBeVisible()
  await page.getByLabel('Nombre').fill('Cuenta editada')
  await page.getByLabel('Saldo inicial').fill('120000')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Cuenta editada')).toBeVisible()
  await expect(page.getByText('$ 119.900', { exact: true })).toBeVisible()
})

test('la vista móvil no genera overflow horizontal', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) > 390, 'Validación exclusiva del viewport móvil')
  await completeOnboarding(page)
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
})

test('los formularios muestran errores y el modal restaura el foco', async ({ page }) => {
  await completeOnboarding(page)
  const trigger = page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first()
  await trigger.focus()
  await trigger.click()
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page.getByText('Ingresá un importe.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Nuevo movimiento' })).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('nuevo movimiento usa defaults actuales y se limpia después de guardar', async ({ page }) => {
  await completeOnboarding(page)
  const trigger = page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first()

  await trigger.click()
  const expectedDate = await page.evaluate(() => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()))
  await expect(page.getByLabel('Fecha')).toHaveText(expectedDate)
  await expect(page.getByRole('combobox', { name: 'Cuenta', exact: true })).toContainText('Cuenta diaria · ARS')

  await page.getByLabel('Importe').fill('1250')
  await page.getByLabel('Descripción o comercio').fill('Movimiento temporal')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo movimiento' })).toBeHidden()

  await trigger.click()
  await expect(page.getByLabel('Importe')).toHaveValue('')
  await expect(page.getByLabel('Descripción o comercio')).toHaveValue('')
  await expect(page.getByLabel('Fecha')).toHaveText(expectedDate)
  await expect(page.getByRole('combobox', { name: 'Cuenta', exact: true })).toContainText('Cuenta diaria · ARS')
})

test('los selects de shadcn funcionan con teclado', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  const category = page.getByLabel('Categoría')
  await category.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.getByRole('option', { name: 'Otros', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(category).toContainText('Otros')
})

test('los campos shadcn conservan FormData, validación, fechas opcionales y reset', async ({ page }) => {
  await completeOnboarding(page)
  await openCategories(page)

  const categories = page.getByRole('button', { name: 'Guardar categoría' }).locator('..')
  await categories.getByLabel('Nombre').fill('Bonificaciones')
  await chooseSelect(page, 'Tipo', 'Ingreso', categories)
  await categories.getByRole('button', { name: 'Guardar categoría', exact: true }).click()
  await expect(page.getByText('Categoría guardada.', { exact: true }).last()).toBeVisible()
  await expect(categories.getByLabel('Nombre')).toHaveValue('')
  await expect(categories.getByLabel('Tipo')).toContainText('Gasto')

  await openTools(page)

  const recurring = page.getByRole('button', { name: 'Crear recurrente' }).locator('..')
  await recurring.getByLabel('Concepto').fill('Servicio semanal')
  await recurring.getByLabel('Importe').fill('2500')
  await recurring.getByRole('button', { name: 'Crear recurrente' }).click()
  await expect(recurring.getByLabel('Categoría', { exact: true })).toBeFocused()

  await chooseSelect(page, 'Categoría', 'Supermercado', recurring)
  await chooseSelect(page, 'Frecuencia', 'Semanal', recurring)
  const recurringDate = recurring.getByLabel('Próxima fecha')
  const initialDate = await recurringDate.textContent()
  await recurringDate.click()
  await page.locator('[data-slot="popover-content"] button[data-day]:not([disabled])').last().click()
  await expect(recurringDate).not.toHaveText(initialDate ?? '')
  await recurring.getByRole('button', { name: 'Crear recurrente' }).click()
  await expect(page.getByText('Recurrente guardado.', { exact: true }).last()).toBeVisible()
  await expect(recurring.getByLabel('Concepto')).toHaveValue('')
  await expect(recurring.getByLabel('Categoría', { exact: true })).toContainText('Elegí una opción')
  await expect(recurring.getByLabel('Frecuencia')).toContainText('Mensual')
  await expect(recurringDate).toHaveText(initialDate ?? '')

  const debts = page.getByRole('button', { name: 'Crear deuda' }).locator('..')
  const dueDate = debts.getByLabel('Vencimiento')
  await dueDate.click()
  await page.locator('[data-slot="popover-content"] button[data-day]:not([disabled])').first().click()
  await expect(dueDate).not.toContainText('Elegí una fecha')
  await dueDate.click()
  await page.getByRole('button', { name: 'Limpiar fecha' }).click()
  await expect(dueDate).toContainText('Elegí una fecha')
})

test('las categorías permiten crear, reubicar y archivar ramas', async ({ page }) => {
  await completeOnboarding(page)
  await openCategories(page)
  const createForm = page.getByRole('button', { name: 'Guardar categoría' }).locator('..')

  const createCategory = async (name: string, parent?: string) => {
    const nameField = createForm.getByLabel('Nombre')
    await nameField.fill(name)
    if (parent) await chooseSelect(page, 'Categoría padre (opcional)', parent, createForm)
    const save = createForm.getByRole('button', { name: 'Guardar categoría', exact: true })
    await save.click()
    await expect(nameField).toHaveValue('')
    await expect(save).toBeEnabled()
  }

  await createCategory('Hogar árbol')
  await createCategory('Servicios árbol', 'Hogar árbol')
  await createCategory('Internet árbol', '— Servicios árbol')

  const rows = page.getByTestId('category-row')
  const tree = await rows.evaluateAll(elements => elements.map(element => ({
    name: element.querySelector('button')?.textContent?.trim(),
    depth: element.getAttribute('data-depth'),
  })))
  const parentIndex = tree.findIndex(item => item.name?.includes('Hogar árbol'))
  expect(tree.slice(parentIndex, parentIndex + 3)).toEqual([
    { name: 'Hogar árbolGasto', depth: '0' },
    { name: 'Servicios árbolGasto · Nivel 2', depth: '1' },
    { name: 'Internet árbolGasto · Nivel 3', depth: '2' },
  ])

  const childRow = rows.filter({ hasText: 'Servicios árbol' })
  await childRow.getByRole('button', { name: 'Editar categoría Servicios árbol' }).click()
  const editor = page.locator('aside').filter({ has: page.getByRole('heading', { name: 'Editar categoría' }) })
  await expect(editor.getByLabel('Tipo')).toHaveCount(0)
  const parentCategory = editor.getByLabel('Categoría padre (opcional)')
  await parentCategory.click()
  await expect(page.getByRole('option', { name: 'Servicios árbol', exact: true })).toHaveCount(0)
  await expect(page.getByRole('option', { name: /Internet árbol/ })).toHaveCount(0)
  await page.getByRole('option', { name: 'Sin padre', exact: true }).press('Enter')
  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(parentCategory).toContainText('Sin padre')
  await editor.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Categoría actualizada y reubicada.', { exact: true }).last()).toBeVisible()
  await expect(childRow).toHaveAttribute('data-depth', '0')
  await expect(rows.filter({ hasText: 'Internet árbol' })).toHaveAttribute('data-depth', '1')

  await childRow.getByRole('button', { name: 'Archivar categoría Servicios árbol' }).click()
  const archiveDialog = page.getByRole('alertdialog')
  await expect(archiveDialog.getByRole('heading', { name: '¿Archivar esta categoría?' })).toBeVisible()
  await archiveDialog.getByRole('button', { name: 'Archivar', exact: true }).click()
  await expect(page.getByText('Categoría archivada.', { exact: true }).last()).toBeVisible()
  await expect(childRow).toBeHidden()
  await page.getByText('Categorías archivadas', { exact: true }).click()
  await expect(childRow).toBeVisible()
  await expect(childRow).toHaveAttribute('data-archived', 'true')
  await expect(childRow.getByText('Archivada', { exact: true })).toBeVisible()
})

test('archivar una cuenta requiere confirmación', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()

  await page.getByRole('button', { name: 'Archivar cuenta Cuenta diaria' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog.getByRole('heading', { name: '¿Archivar esta cuenta?' })).toBeVisible()
  await expect(dialog).toContainText('Su historial se conserva.')
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByText('Cuenta archivada.', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Archivar cuenta Cuenta diaria' }).click()
  await dialog.getByRole('button', { name: 'Archivar', exact: true }).click()
  await expect(page.getByText('Cuenta archivada.', { exact: true }).last()).toBeVisible()
})

test('eliminar un movimiento requiere confirmación accesible', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByLabel('Importe').fill('100')
  await page.getByLabel('Descripción o comercio').fill('Movimiento descartable')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await page.getByRole('button', { name: 'Movimientos' }).first().click()
  await page.getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('¿Eliminar este movimiento?')
  await page.getByRole('button', { name: 'Cancelar' }).click()
  const movementRow = page.getByTestId('movement-row').filter({ hasText: 'Movimiento descartable' })
  await expect(movementRow).toBeVisible()
  await page.getByRole('button', { name: 'Eliminar' }).click()
  await page.getByRole('button', { name: 'Eliminar' }).last().click()
  await expect(movementRow).toBeHidden()
})

test('movimientos abre filtrado desde el primer día del mes actual', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: 'Movimientos' }).first().click()
  await page.getByRole('button', { name: 'Filtrar, hay filtros activos' }).click()

  const firstDayLabel = await page.evaluate(() => {
    const date = new Date()
    return `01/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
  })
  await expect(page.getByRole('button', { name: `Fecha desde: ${firstDayLabel}` })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fecha hasta: Elegí una fecha' })).toBeVisible()
})

test('el filtro de movimientos permite combinar criterios y limpiarlos', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: /(?:Nuevo|Agregar) movimiento/i }).first().click()
  await page.getByLabel('Importe').fill('100')
  await page.getByLabel('Descripción o comercio').fill('Compra filtrable')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await page.getByRole('button', { name: 'Movimientos' }).first().click()

  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByRole('button', { name: /Fecha desde/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Fecha hasta/ })).toBeVisible()
  await chooseSelect(page, 'Tipo de movimiento', 'Ingresos')
  await expect(page.getByText('Compra filtrable')).toBeHidden()
  await expect(page.getByText('0 movimientos encontrados')).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(page.getByText('Compra filtrable')).toBeVisible()

  const search = page.getByRole('textbox', { name: 'Buscar movimientos' })
  await search.fill('Compra filtrable')
  const clearSearch = page.getByRole('button', { name: 'Limpiar búsqueda' })
  await clearSearch.click()
  await expect(search).toHaveValue('')
  await expect(search).toBeFocused()

  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.locator('#movement-filters')).toHaveCount(0)

  const row = page.getByRole('button', { name: 'Editar movimiento Compra filtrable' })
  await row.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Editar movimiento' })).toBeVisible()
})

test('adapta la paginación a una, dos y tres columnas', async ({ page }) => {
  await completeOnboarding(page)
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('de-la-geezy')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const stamp = new Date().toISOString()
    const transaction = database.transaction('transactions', 'readwrite')
    const store = transaction.objectStore('transactions')
    for (let index = 1; index <= 61; index += 1) {
      store.put({ id: `pagination-${index}`, date: `2026-11-${String(Math.min(index, 30)).padStart(2, '0')}`, amountMinor: index * 100, currency: 'ARS', type: 'expense', status: 'confirmed', description: `Movimiento paginado ${String(index).padStart(2, '0')}`, tags: [], createdAt: stamp, updatedAt: stamp })
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await page.reload()
  await page.getByRole('button', { name: 'Movimientos' }).first().click()

  await expect(page.getByTestId('movement-row')).toHaveCount(25)
  await expect(page.getByText('Mostrando 1–25 de 61')).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByTestId('movement-row')).toHaveCount(25)
  await expect(page.getByText('Página 2 de 3')).toBeVisible()

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByTestId('movement-row')).toHaveCount(26)
  await expect(page.getByText('Mostrando 1–26 de 61')).toBeVisible()

  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Mostrando 27–52 de 61')).toBeVisible()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await expect(page.getByTestId('movement-row')).toHaveCount(27)
  await expect(page.getByText('Mostrando 1–27 de 61')).toBeVisible()

  await page.getByRole('textbox', { name: 'Buscar movimientos' }).fill('Movimiento paginado 30')
  await expect(page.getByText('Página 1 de 1')).toBeVisible()
  await expect(page.getByText('Movimiento paginado 30')).toBeVisible()
})

test('importa un resumen de Mercado Pago después de revisar transferencias', async ({ page }) => {
  await completeOnboarding(page)
  await page.getByRole('button', { name: 'Movimientos' }).first().click()
  await page.getByRole('button', { name: 'Importar resumen' }).click()
  await page.locator('input[type="file"]').setInputFiles({ name: 'mercado-pago-septiembre.pdf', mimeType: 'application/pdf', buffer: mercadoPagoPdfFixture() })

  await expect(page.getByText(/1 gastos seleccionados/)).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Quedan 1 transferencias')
  await page.getByLabel('No, excluir').check()
  await page.getByRole('button', { name: 'Importar 1 gastos' }).click()

  await expect(page.getByText('Importación terminada')).toBeVisible()
  await page.getByRole('button', { name: 'Ver movimientos' }).click()
  await expect(page.getByText('Pago Sube viajes')).toBeVisible()
  await expect(page.getByText('Transferencia enviada Ana')).toBeHidden()
})
