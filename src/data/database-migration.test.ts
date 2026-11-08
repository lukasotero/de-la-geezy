import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { GeezyDatabase } from './database'

const names: string[] = []
afterEach(async () => { await Promise.all(names.splice(0).map(name => Dexie.delete(name))) })

describe('migraciones Dexie desde v5', () => {
  it('preserva compras y pagos existentes como activos y elimina las tablas retiradas', async () => {
    const name = `migration-${crypto.randomUUID()}`; names.push(name)
    const legacy = new Dexie(name)
    legacy.version(5).stores({
      transactions: 'id, date, type, status, currency, accountId, destinationAccountId, cardId, categoryId, description, relatedId, [status+date], importBatchId, &[source+currency+externalId], adjustmentDirection',
      cardPurchases: 'id, cardId, purchaseDate, categoryId',
      installments: 'id, purchaseId, cardId, statementDate, dueDate, status, statementId, [cardId+status]',
      cardStatements: 'id, cardId, period, dueDate, status, [cardId+period]',
      cardPayments: 'id, statementId, cardId, accountId, date, transactionId',
      reminderDefinitions: 'id, kind, dueDate, dismissed, relatedId',
    })
    const stamp = '2026-11-04T12:00:00.000Z'
    await legacy.table('cardPurchases').add({ id: 'purchase', cardId: 'card', purchaseDate: '2026-11-04', description: 'Legada', totalMinor: 10000, currency: 'ARS', installmentCount: 1, createdAt: stamp, updatedAt: stamp })
    await legacy.table('cardPayments').add({ id: 'payment', statementId: 'statement', cardId: 'card', accountId: 'account', date: '2026-12-10', amountMinor: 10000, currency: 'ARS', transactionId: 'movement', createdAt: stamp, updatedAt: stamp })
    await legacy.table('transactions').add({ id: 'movement', date: '2026-12-10', amountMinor: 10000, currency: 'ARS', type: 'card-payment', status: 'confirmed', description: 'Pago legado', tags: [], createdAt: stamp, updatedAt: stamp })
    await legacy.table('reminderDefinitions').add({ id: 'legacy-reminder', kind: 'card-due', dueDate: '2026-12-10', dismissed: false })
    legacy.close()

    const current = new GeezyDatabase(name)
    await current.open()
    expect(await current.cardPurchases.get('purchase')).toMatchObject({ status: 'active', description: 'Legada' })
    expect(await current.cardPayments.get('payment')).toMatchObject({ status: 'active', transactionId: 'movement' })
    expect(await current.transactions.get('movement')).toMatchObject({ status: 'confirmed' })
    expect(current.tables.map(table => table.name)).not.toContain('reminderDefinitions')
    expect(current.verno).toBe(7)
    current.close()
  })
})
