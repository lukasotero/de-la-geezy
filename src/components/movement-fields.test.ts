import { describe, expect, it } from 'vitest'
import { formatArgentineAmount, normalizeArgentineAmount } from './movement-field-format'

describe('importe con formato argentino', () => {
  it('agrega separadores de miles mientras se escribe', () => {
    expect(formatArgentineAmount('1714513')).toBe('1.714.513')
  })

  it('conserva la coma y limita los centavos a dos dígitos', () => {
    expect(formatArgentineAmount('1714513,259')).toBe('1.714.513,25')
  })

  it('entrega un valor decimal normalizado al formulario', () => {
    expect(normalizeArgentineAmount('1.714.513,25')).toBe('1714513.25')
  })
})
