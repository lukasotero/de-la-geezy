import { describe, expect, it } from 'vitest'
import { assetFormSchema, movementFormSchema, onboardingFormSchema } from './form-schemas'

describe('esquemas de formularios', () => {
  it('rechaza onboarding sin nombre y saldos inválidos', () => {
    const result = onboardingFormSchema.safeParse({ name: '  ', balance: 'abc', currency: 'ARS' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.flatten().fieldErrors).toMatchObject({ name: ['Ingresá un nombre.'], balance: ['Ingresá un importe válido.'] })
  })

  it('requiere importe positivo y categoría en un gasto', () => {
    const result = movementFormSchema.safeParse({ kind: 'expense', amount: '0', description: '', accountId: 'account-1', categoryId: '', date: '2026-11-04', status: 'confirmed' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.flatten().fieldErrors).toMatchObject({ amount: ['El importe debe ser mayor que cero.'], categoryId: ['Elegí una categoría.'] })
  })

  it('requiere una cuenta de destino distinta en transferencias', () => {
    const base = { kind: 'transfer', amount: '100', description: '', accountId: 'account-1', categoryId: '', date: '2026-11-04', status: 'confirmed' }
    expect(movementFormSchema.safeParse(base).success).toBe(false)
    expect(movementFormSchema.safeParse({ ...base, destinationAccountId: 'account-1' }).success).toBe(false)
    expect(movementFormSchema.safeParse({ ...base, destinationAccountId: 'account-2' }).success).toBe(true)
  })

  it('valida por separado cuentas y tarjetas', () => {
    expect(assetFormSchema.safeParse({ mode: 'account', name: 'Billetera', balance: '2500', currency: 'ARS', accountType: 'wallet' }).success).toBe(true)
    expect(assetFormSchema.safeParse({ mode: 'card', name: '', issuer: '', brand: 'Otra', lastFour: '', closingDay: '', dueDay: '', currency: 'USD' }).success).toBe(false)
  })

  it('valida fechas y últimos cuatro de tarjetas sin exigirlos', () => {
    const base = { mode: 'card', name: 'Platinum', issuer: 'Banco', brand: 'Visa', currency: 'ARS' }
    expect(assetFormSchema.safeParse({ ...base, lastFour: '', closingDay: '', dueDay: '' }).success).toBe(true)
    expect(assetFormSchema.safeParse({ ...base, lastFour: '123', closingDay: '32', dueDay: '0' }).success).toBe(false)
    expect(assetFormSchema.safeParse({ ...base, lastFour: '1234', closingDay: '25', dueDay: '10' }).success).toBe(true)
  })
})
