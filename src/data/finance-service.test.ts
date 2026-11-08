import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { GeezyDatabase } from './database'
import { FinanceService } from './finance-service'

const databases: GeezyDatabase[] = []
async function setup() {
  const database = new GeezyDatabase(`finance-service-${crypto.randomUUID()}`); databases.push(database)
  const stamp = '2026-11-04T12:00:00.000Z'
  await database.accounts.bulkAdd([
    { id: 'ars', name: 'Banco', type: 'bank', currency: 'ARS', initialBalanceMinor: 1_000_000, active: true, createdAt: stamp, updatedAt: stamp },
    { id: 'usd', name: 'Dólares', type: 'savings', currency: 'USD', initialBalanceMinor: 0, active: true, createdAt: stamp, updatedAt: stamp },
  ])
  await database.categories.add({ id: 'services', name: 'Servicios', kind: 'expense', icon: 'Shapes', color: '#ffffff', order: 0, archived: false, createdAt: stamp, updatedAt: stamp })
  return { database, service: new FinanceService(database), stamp }
}
async function addCard(database: GeezyDatabase, stamp: string, id = 'card', currency: 'ARS' | 'USD' = 'ARS') {
  await database.creditCards.add({ id, name: id === 'card' ? 'Visa' : 'Mastercard', issuer: 'Banco', brand: id === 'card' ? 'Visa' : 'Mastercard', currency, closingDay: 25, dueDay: 10, active: true, createdAt: stamp, updatedAt: stamp })
}
afterEach(async () => { await Promise.all(databases.splice(0).map(async database => { database.close(); await database.delete() })) })

describe('servicio financiero transaccional', () => {
  it('fija la venta oficial al crear movimientos USD y no la revaloriza', async () => {
    const { database, service, stamp } = await setup()
    await database.exchangeRates.add({ id: 'rate-1450', source: 'dolarapi', rateType: 'official', buy: 1450, sell: 1450, fetchedAt: stamp, createdAt: stamp, updatedAt: stamp })
    const movement = await service.createMovement({ date: '2026-11-04', amount: '600', currency: 'USD', type: 'expense', status: 'confirmed', accountId: 'usd', description: 'Compra USD' })
    expect(movement).toMatchObject({ exchangeRateId: 'rate-1450', effectiveRate: 1450 })
    await database.exchangeRates.add({ id: 'rate-1500', source: 'dolarapi', rateType: 'official', buy: 1500, sell: 1500, fetchedAt: '2026-11-04T13:00:00.000Z', createdAt: stamp, updatedAt: stamp })
    expect(await service.reconcileUsdRates()).toBe(0)
    expect(await database.transactions.get(movement.id)).toMatchObject({ exchangeRateId: 'rate-1450', effectiveRate: 1450 })
  })

  it('reconcilia una sola vez los movimientos USD sin cotización', async () => {
    const { database, service, stamp } = await setup()
    const movement = await service.createMovement({ date: '2026-11-04', amount: '10', currency: 'USD', type: 'income', status: 'confirmed', accountId: 'usd', description: 'Ingreso USD' })
    expect(movement.effectiveRate).toBeUndefined()
    const rate = { id: 'rate', source: 'dolarapi' as const, rateType: 'official' as const, buy: 1450, sell: 1450, fetchedAt: stamp, createdAt: stamp, updatedAt: stamp }
    await database.exchangeRates.add(rate)
    expect(await service.reconcileUsdRates(rate)).toBe(1)
    expect(await service.reconcileUsdRates({ ...rate, id: 'new-rate', sell: 1600 })).toBe(0)
    expect(await database.transactions.get(movement.id)).toMatchObject({ exchangeRateId: 'rate', effectiveRate: 1450 })
  })

  it('fija cotización en compras, pagos de tarjeta y deudas USD', async () => {
    const { database, service, stamp } = await setup()
    await database.exchangeRates.add({ id: 'rate', source: 'dolarapi', rateType: 'official', buy: 1450, sell: 1450, fetchedAt: stamp, createdAt: stamp, updatedAt: stamp })
    await addCard(database, stamp, 'usd-card', 'USD')
    await service.createCardPurchase({ cardId: 'usd-card', purchaseDate: '2026-11-04', description: 'Compra USD', amount: '100', installmentCount: 1 })
    await service.buildStatements()
    const statement = (await database.cardStatements.toArray())[0]
    await service.payCard(statement.id, 'usd', '100', '2026-12-10')
    const debt = await service.saveDebt({ name: 'Deuda USD', creditor: 'Banco', initialPrincipalMinor: 10000, outstandingMinor: 10000, currency: 'USD', active: true })
    await service.payDebt({ debtId: debt.id, accountId: 'usd', date: '2026-11-04', principal: '100', interest: '10' })
    expect((await database.transactions.toArray()).filter(item => item.currency === 'USD').every(item => item.effectiveRate === 1450 && item.exchangeRateId === 'rate')).toBe(true)
  })

  it('conserva tasa e importes en una transferencia entre monedas', async () => {
    const { database, service, stamp } = await setup()
    await database.exchangeRates.bulkAdd([
      { id: 'rate', source: 'dolarapi', rateType: 'official', buy: 1400, sell: 1450, fetchedAt: stamp, createdAt: stamp, updatedAt: stamp },
      { id: 'manual-newer', source: 'manual', rateType: 'custom', buy: 1, sell: 1, fetchedAt: '2026-11-04T13:00:00.000Z', createdAt: stamp, updatedAt: stamp },
    ])
    const transfer = await service.createTransfer({ date: '2026-11-04', originAccountId: 'ars', destinationAccountId: 'usd', amount: '1450' })
    expect(transfer).toMatchObject({ amountMinor: 145000, destinationAmountMinor: 100, exchangeRateId: 'rate' })
  })

  it('usa venta también al convertir dólares a pesos', async () => {
    const { database, service, stamp } = await setup()
    await database.exchangeRates.add({ id: 'rate', source: 'dolarapi', rateType: 'official', buy: 1300, sell: 1450, fetchedAt: stamp, createdAt: stamp, updatedAt: stamp })
    const transfer = await service.createTransfer({ date: '2026-11-04', originAccountId: 'usd', destinationAccountId: 'ars', amount: '1' })
    expect(transfer).toMatchObject({ amountMinor: 100, destinationAmountMinor: 145000, exchangeRateId: 'rate' })
  })

  it('crea una compra y cuotas cuya suma coincide exactamente', async () => {
    const { database, service, stamp } = await setup()
    await addCard(database, stamp)
    const result = await service.createCardPurchase({ cardId: 'card', categoryId: 'services', purchaseDate: '2026-11-04', description: 'Equipo', amount: '100', installmentCount: 3 })
    expect(result.installments.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(10000)
    expect((await database.transactions.toArray())[0]).toMatchObject({ type: 'expense', cardId: 'card' })
  })

  it('edita una compra, anula el cronograma anterior y conserva la suma exacta', async () => {
    const { database, service, stamp } = await setup(); await addCard(database, stamp)
    const { purchase } = await service.createCardPurchase({ cardId: 'card', categoryId: 'services', purchaseDate: '2026-11-04', description: 'Equipo', amount: '100', installmentCount: 3 })
    await service.buildStatements()
    const result = await service.updateCardPurchase(purchase.id, { cardId: 'card', categoryId: 'services', purchaseDate: '2026-11-06', description: 'Equipo corregido', amount: '101', installmentCount: 4 })
    expect(result.installments.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(10100)
    const all = await database.installments.where('purchaseId').equals(purchase.id).toArray()
    expect(all.filter(item => item.status === 'void')).toHaveLength(3)
    expect(all.filter(item => item.status !== 'void')).toHaveLength(4)
    expect((await database.transactions.where('relatedId').equals(purchase.id).first())).toMatchObject({ description: 'Equipo corregido', amountMinor: 10100 })
    expect((await database.cardStatements.toArray()).reduce((sum, item) => sum + item.amountMinor, 0)).toBe(10100)
  })

  it('traslada una compra a otra tarjeta y recalcula los resúmenes', async () => {
    const { database, service, stamp } = await setup(); await addCard(database, stamp); await addCard(database, stamp, 'card-2')
    const { purchase } = await service.createCardPurchase({ cardId: 'card', purchaseDate: '2026-11-04', description: 'Compra', amount: '90', installmentCount: 2 })
    await service.buildStatements()
    await service.updateCardPurchase(purchase.id, { cardId: 'card-2', purchaseDate: '2026-11-04', description: 'Compra', amount: '90', installmentCount: 2 })
    const active = (await database.installments.where('purchaseId').equals(purchase.id).toArray()).filter(item => item.status !== 'void')
    expect(active.every(item => item.cardId === 'card-2')).toBe(true)
    expect((await database.cardStatements.where('cardId').equals('card').toArray()).every(item => item.status === 'void')).toBe(true)
    expect((await database.cardStatements.where('cardId').equals('card-2').toArray()).reduce((sum, item) => sum + item.amountMinor, 0)).toBe(9000)
  })

  it('bloquea edición y anulación de una compra con pagos activos', async () => {
    const { database, service, stamp } = await setup(); await addCard(database, stamp)
    const { purchase } = await service.createCardPurchase({ cardId: 'card', purchaseDate: '2026-11-04', description: 'Compra', amount: '100', installmentCount: 1 })
    await service.buildStatements(); const statement = (await database.cardStatements.toArray())[0]
    await service.payCard(statement.id, 'ars', '50', '2026-12-10')
    await expect(service.updateCardPurchase(purchase.id, { cardId: 'card', purchaseDate: '2026-11-04', description: 'Cambio', amount: '80', installmentCount: 1 })).rejects.toMatchObject({ code: 'INVALID_RELATION' })
    await expect(service.voidCardPurchase(purchase.id)).rejects.toMatchObject({ code: 'INVALID_RELATION' })
  })

  it('edita y anula un pago parcial restaurando movimiento y resumen', async () => {
    const { database, service, stamp } = await setup(); await addCard(database, stamp)
    const { purchase } = await service.createCardPurchase({ cardId: 'card', purchaseDate: '2026-11-04', description: 'Compra', amount: '100', installmentCount: 1 })
    await service.buildStatements(); const statement = (await database.cardStatements.toArray())[0]
    const payment = await service.payCard(statement.id, 'ars', '40', '2026-12-10')
    await service.updateCardPayment(payment.id, { accountId: 'ars', date: '2026-12-11', amount: '60' })
    expect(await database.cardStatements.get(statement.id)).toMatchObject({ paidMinor: 6000, status: 'partial' })
    expect(await database.transactions.get(payment.transactionId)).toMatchObject({ amountMinor: 6000, date: '2026-12-11', status: 'confirmed' })
    await service.voidCardPayment(payment.id, 'Pago duplicado')
    expect(await database.cardStatements.get(statement.id)).toMatchObject({ paidMinor: 0, status: 'open' })
    expect(await database.transactions.get(payment.transactionId)).toMatchObject({ status: 'void', voidReason: 'Pago duplicado' })
    await service.voidCardPurchase(purchase.id)
    expect(await database.cardPurchases.get(purchase.id)).toMatchObject({ status: 'void' })
  })

  it('anula un pago total y devuelve las cuotas al resumen', async () => {
    const { database, service, stamp } = await setup(); await addCard(database, stamp)
    await service.createCardPurchase({ cardId: 'card', purchaseDate: '2026-11-04', description: 'Compra', amount: '100', installmentCount: 1 })
    await service.buildStatements(); const statement = (await database.cardStatements.toArray())[0]
    const payment = await service.payCard(statement.id, 'ars', '100', '2026-12-10')
    expect((await database.installments.toArray())[0].status).toBe('paid')
    await service.voidCardPayment(payment.id)
    expect(await database.cardStatements.get(statement.id)).toMatchObject({ paidMinor: 0, status: 'open' })
    expect((await database.installments.toArray())[0].status).toBe('statement')
  })

  it('revierte por completo una edición si falta una relación', async () => {
    const { database, service, stamp } = await setup(); await addCard(database, stamp)
    const { purchase } = await service.createCardPurchase({ cardId: 'card', purchaseDate: '2026-11-04', description: 'Original', amount: '100', installmentCount: 2 })
    const expense = await database.transactions.where('relatedId').equals(purchase.id).first(); await database.transactions.delete(expense!.id)
    const before = await database.installments.where('purchaseId').equals(purchase.id).toArray()
    await expect(service.updateCardPurchase(purchase.id, { cardId: 'card', purchaseDate: '2026-11-05', description: 'Fallida', amount: '80', installmentCount: 3 })).rejects.toMatchObject({ code: 'INVALID_RELATION' })
    expect(await database.cardPurchases.get(purchase.id)).toMatchObject({ description: 'Original', totalMinor: 10000 })
    expect(await database.installments.where('purchaseId').equals(purchase.id).toArray()).toEqual(before)
  })

  it('reconcilia recurrentes sin duplicar y confirma el movimiento real', async () => {
    const { database, service } = await setup()
    await service.saveRecurringRule({ kind: 'expense', description: 'Alquiler', amountMinor: 200000, currency: 'ARS', categoryId: 'services', suggestedAccountId: 'ars', frequency: 'monthly', nextDate: '2026-10-31', autoGenerate: false, active: true })
    expect(await service.reconcileRecurring('2026-11-30')).toBe(2)
    expect(await service.reconcileRecurring('2026-11-30')).toBe(0)
    const occurrence = (await database.recurringOccurrences.toArray())[0]
    await service.resolveOccurrence(occurrence.id, 'confirm', { accountId: 'ars' })
    expect(await database.transactions.count()).toBe(1)
  })

  it('separa capital e intereses al pagar una deuda', async () => {
    const { database, service } = await setup()
    const debt = await service.saveDebt({ name: 'Préstamo', creditor: 'Banco', initialPrincipalMinor: 500000, outstandingMinor: 500000, currency: 'ARS', active: true })
    await service.payDebt({ debtId: debt.id, accountId: 'ars', date: '2026-11-04', principal: '1000', interest: '100' })
    expect((await database.transactions.toArray()).map(item => item.type).sort()).toEqual(['debt-payment', 'expense'])
    expect((await database.debts.get(debt.id))?.outstandingMinor).toBe(400000)
  })
})
