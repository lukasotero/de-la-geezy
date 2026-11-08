import { describe, expect, it } from 'vitest'
import { formatCardDate, getCardCycle } from './card-cycle'

describe('ciclo de tarjeta', () => {
  it('mantiene el cierre anterior mientras su vencimiento siga vigente', () => {
    const cycle = getCardCycle(29, 11, new Date(2026, 10, 2))
    expect(formatCardDate(cycle.closingDate)).toBe('29/10')
    expect(formatCardDate(cycle.dueDate)).toBe('11/11')
  })

  it('avanza al próximo ciclo cuando el vencimiento ya pasó', () => {
    const cycle = getCardCycle(29, 11, new Date(2026, 10, 12))
    expect(formatCardDate(cycle.closingDate)).toBe('29/11')
    expect(formatCardDate(cycle.dueDate)).toBe('11/12')
  })

  it('mantiene el vencimiento en el mismo mes cuando su día es posterior al cierre', () => {
    const cycle = getCardCycle(5, 20, new Date(2026, 9, 10))
    expect(formatCardDate(cycle.closingDate)).toBe('05/10')
    expect(formatCardDate(cycle.dueDate)).toBe('20/10')
  })

  it('resuelve cambios de año y días inexistentes al último día del mes', () => {
    const cycle = getCardCycle(31, 10, new Date(2027, 0, 15))
    expect(formatCardDate(cycle.closingDate)).toBe('31/01')
    expect(formatCardDate(cycle.dueDate)).toBe('10/02')

    const february = getCardCycle(31, 10, new Date(2027, 1, 25))
    expect(formatCardDate(february.closingDate)).toBe('28/02')
    expect(formatCardDate(february.dueDate)).toBe('10/03')
  })
})
