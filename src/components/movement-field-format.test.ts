import { describe, expect, it } from 'vitest'
import { insertArgentineDecimalSeparator, normalizeArgentineAmount } from './movement-field-format'

describe('movement amount keyboard input', () => {
  it('treats a typed point as a decimal comma without removing thousands grouping', () => {
    const formatted = insertArgentineDecimalSeparator('1.234', 5, 5)

    expect(formatted).toBe('1.234,')
    expect(normalizeArgentineAmount(formatted)).toBe('1234.')
  })

  it('keeps the comma behavior available', () => {
    expect(normalizeArgentineAmount('1.234,56')).toBe('1234.56')
  })
})
