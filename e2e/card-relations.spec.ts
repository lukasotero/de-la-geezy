import { expect, test } from './fixtures/app.fixture'

async function createCard(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Cuentas y tarjetas' }).first().click()
  await page.getByRole('button', { name: 'Nueva tarjeta' }).click()
  await page.getByLabel('Nombre de la tarjeta').fill('Visa prueba')
  await page.getByLabel('Banco o emisor').fill('Banco prueba')
  await page.getByLabel('Día de cierre (opcional)').fill('25')
  await page.getByLabel('Día de vencimiento (opcional)').fill('10')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Visa prueba', { exact: true })).toBeVisible()
}

async function openTools(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Más', exact: true }).first().click()
  const menuHeading = page.getByRole('heading', { name: 'Más', exact: true })
  if (await menuHeading.isVisible()) await page.getByRole('button', { name: /^Herramientas/ }).click()
  await expect(page.getByRole('heading', { name: 'Compras y resúmenes' })).toBeVisible()
}

function cardPanel(page: import('@playwright/test').Page) {
  return page.getByRole('heading', { name: 'Compras y resúmenes' }).locator('..').locator('..')
}

async function createPurchase(page: import('@playwright/test').Page) {
  const panel = cardPanel(page)
  await panel.getByLabel('Comercio o concepto').fill('Notebook')
  await panel.getByLabel('Importe', { exact: true }).first().fill('1200')
  await panel.getByLabel('Cuotas').fill('3')
  await panel.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(page.getByRole('status')).toContainText('Compra y cuotas creadas.')
  await expect(page.getByRole('article').filter({ hasText: 'Notebook' }).first()).toContainText('3 cuotas')
}

test('compra, pago parcial, edición y anulación mantienen relaciones y foco', async ({ appPage: page, completeOnboarding }) => {
  await completeOnboarding(); await createCard(page); await openTools(page); await createPurchase(page)

  const purchase = cardPanel(page).getByRole('article').filter({ hasText: 'Notebook' }).first()
  const editPurchase = purchase.getByRole('button', { name: /^Editar compra/ })
  await editPurchase.focus(); await editPurchase.click()
  await expect(page.getByRole('dialog', { name: 'Editar compra' })).toBeVisible()
  await page.getByLabel('Importe', { exact: true }).last().fill('1500')
  await page.getByLabel('Cuotas', { exact: true }).last().fill('2')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status')).toContainText('Compra y cronograma actualizados.')
  await expect(editPurchase).toBeFocused()
  await expect(purchase).toContainText('2 cuotas')

  const statement = cardPanel(page).getByRole('article').filter({ hasText: /Visa prueba.*vence/s }).last()
  await statement.getByLabel('Importe a pagar').fill('500')
  await statement.getByRole('button', { name: 'Registrar pago' }).click()
  await expect(page.getByRole('status')).toContainText('Pago registrado.')
  await expect(statement).toContainText('pagado $ 500')

  const editPayment = statement.getByRole('button', { name: /^Editar pago/ })
  await editPayment.click()
  await page.getByRole('dialog', { name: 'Editar pago' }).getByLabel('Importe').fill('600')
  await page.getByRole('dialog', { name: 'Editar pago' }).getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status')).toContainText('Pago actualizado')
  await expect(statement).toContainText('pagado $ 600')

  const voidPayment = statement.getByRole('button', { name: /^Anular pago/ })
  await voidPayment.focus(); await voidPayment.click()
  const paymentDialog = page.getByRole('dialog', { name: 'Anular pago' })
  await expect(paymentDialog).toContainText('Se restauran $ 600')
  await paymentDialog.getByLabel('Motivo (opcional)').fill('Pago duplicado')
  await paymentDialog.getByRole('button', { name: 'Confirmar anulación' }).click()
  await expect(page.getByRole('status')).toContainText('Pago anulado')
  await expect(voidPayment).toBeHidden()
  await expect(statement).toContainText('pagado $ 0')
})

test('una compra pagada exige revertir el pago antes de anularla', async ({ appPage: page, completeOnboarding }) => {
  await completeOnboarding(); await createCard(page); await openTools(page); await createPurchase(page)
  const statement = cardPanel(page).getByRole('article').filter({ hasText: /Visa prueba.*vence/s }).last()
  await statement.getByLabel('Importe a pagar').fill('400')
  await statement.getByRole('button', { name: 'Registrar pago' }).click()

  const purchase = cardPanel(page).getByRole('article').filter({ hasText: 'Notebook' }).first()
  await purchase.getByRole('button', { name: /^Anular compra/ }).click()
  const blocked = page.getByRole('dialog', { name: 'Anular compra' })
  await expect(blocked.getByRole('alert')).toContainText('Primero anulá los pagos activos')
  await expect(blocked.getByRole('button', { name: 'Confirmar anulación' })).toBeDisabled()
  await page.keyboard.press('Escape')

  await statement.getByRole('button', { name: /^Anular pago/ }).click()
  await page.getByRole('dialog', { name: 'Anular pago' }).getByRole('button', { name: 'Confirmar anulación' }).click()
  await purchase.getByRole('button', { name: /^Anular compra/ }).click()
  const allowed = page.getByRole('dialog', { name: 'Anular compra' })
  await expect(allowed).toContainText('Desaparece el gasto')
  await allowed.getByRole('button', { name: 'Confirmar anulación' }).click()
  await expect(page.getByRole('status')).toContainText('Compra anulada')
  await expect(page.getByText('Notebook')).toBeHidden()
  await page.getByRole('checkbox', { name: 'Incluir anulados' }).check()
  await expect(page.getByRole('article').filter({ hasText: 'Notebook' }).first()).toContainText('Anulada')
})
