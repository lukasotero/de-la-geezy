import { describe, expect, it } from 'vitest'
import type { Transaction } from '@/models/entities'
import { analyticsAmountInArs, pendingUsdConversionCount } from './analytics-currency'

const stamp = '2026-11-04T12:00:00.000Z'
const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(), date: '2026-11-04', amountMinor: 60_000, currency: 'USD', type: 'expense', status: 'confirmed',
  description: 'Gasto', tags: [], createdAt: stamp, updatedAt: stamp, ...overrides,
})

describe('conversión para análisis', () => {
  it('convierte USD 600 a ARS con la tasa histórica fija', () => {
    expect(analyticsAmountInArs(transaction({ effectiveRate: 1450 }))).toBe(87_000_000)
  })

  it('mantiene ARS y excluye USD pendiente', () => {
    expect(analyticsAmountInArs(transaction({ currency: 'ARS' }))).toBe(60_000)
    expect(analyticsAmountInArs(transaction({}))).toBeNull()
    expect(pendingUsdConversionCount([transaction({}), transaction({ effectiveRate: 1450 })])).toBe(1)
  })
})
