import { describe, expect, it } from 'vitest'
import { buildInstallmentSchedule, firstStatementDueDate, splitInstallments } from './installments'

describe('cuotas y ciclos de tarjeta', () => {
  it('reparte el resto sin perder centavos', () => {
    const parts = splitInstallments(100_00, 3)
    expect(parts).toEqual([3334, 3333, 3333])
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(100_00)
  })

  it('ubica compras posteriores al cierre en el ciclo siguiente', () => {
    expect(firstStatementDueDate('2026-10-22', 20, 10)).toBe('2026-12-10')
    expect(firstStatementDueDate('2026-10-18', 20, 10)).toBe('2026-11-10')
  })

  it('genera un calendario mensual exacto', () => {
    const schedule = buildInstallmentSchedule(10_00, 3, '2026-01-05', 25, 5)
    expect(schedule.map((item) => item.amount)).toEqual([334, 333, 333])
    expect(schedule.map((item) => item.dueDate)).toEqual(['2026-02-05', '2026-03-05', '2026-04-05'])
  })
})
