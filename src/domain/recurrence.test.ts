import { describe, expect, it } from 'vitest'
import { reconcileRecurringRule } from './recurrence'
import type { RecurringRule } from './types'

const rule: RecurringRule = {
  id: 'internet',
  description: 'Internet',
  amount: 25_000,
  currency: 'ARS',
  frequency: 'monthly',
  nextDate: '2026-01-31',
  active: true,
}

describe('reconciliación de recurrencias', () => {
  it('usa el último día válido y genera pendientes hasta hoy', () => {
    const result = reconcileRecurringRule(rule, [], '2026-03-31')
    expect(result.occurrences.map((item) => item.scheduledDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ])
    expect(result.nextDate).toBe('2026-04-30')
  })

  it('no duplica una ocurrencia ya generada', () => {
    const first = reconcileRecurringRule(rule, [], '2026-02-28')
    const second = reconcileRecurringRule(rule, first.occurrences, '2026-02-28')
    expect(second.occurrences).toHaveLength(0)
  })
})
