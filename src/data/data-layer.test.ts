import { describe, expect, it } from 'vitest'
import { convertCurrency } from './exchange-rate'
import { transactionSchema } from '../models/schemas'
import type { ExchangeRate } from '../models/entities'

const now = '2026-10-29T12:00:00.000Z'
const rate: ExchangeRate = {
  id: 'rate-1', source: 'dolarapi', rateType: 'official', buy: 1400, sell: 1450,
  fetchedAt: now, createdAt: now, updatedAt: now,
}

describe('conversiones', () => {
  it('convierte usando enteros y la convención elegida', () => {
    expect(convertCurrency(100_00, 'USD', 'ARS', rate)).toBe(14_500_000)
    expect(convertCurrency(14_500_000, 'ARS', 'USD', rate)).toBe(10_000)
  })
})

describe('validaciones', () => {
  it('rechaza transferencias sin cuenta de origen', () => {
    expect(() => transactionSchema.parse({
      id: 't1', createdAt: now, updatedAt: now, date: '2026-10-29', amountMinor: 100,
      currency: 'ARS', type: 'transfer', status: 'confirmed', description: 'Pase', tags: [],
    })).toThrow(/cuenta de origen/)
  })
})
