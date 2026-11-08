import { describe, expect, it } from 'vitest'
import { convertMinorUnits, formatMoney, toMinorUnits } from './money'

describe('dinero en unidades mínimas', () => {
  it('convierte importes sin errores binarios', () => {
    expect(toMinorUnits('0,10')).toBe(10)
    expect(toMinorUnits('1250.99')).toBe(125099)
    expect(toMinorUnits(-2.5)).toBe(-250)
  })

  it('rechaza más de dos decimales', () => {
    expect(() => toMinorUnits('1.001')).toThrow()
  })

  it('convierte con una tasa decimal y redondeo explícito', () => {
    expect(convertMinorUnits(10_00, '1050.25')).toBe(1_050_250)
    expect(convertMinorUnits(101, '1.005')).toBe(102)
  })

  it('distingue visualmente pesos de dólares', () => {
    expect(formatMoney(60_000, 'ARS')).toMatch(/^\$\s*600$/)
    expect(formatMoney(60_000, 'USD')).toMatch(/^USD\s*600(?:,00)?$/)
  })
})
