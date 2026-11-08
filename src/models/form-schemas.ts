import { z } from 'zod'

const currencySchema = z.enum(['ARS', 'USD'])
const requiredName = z.string().trim().min(1, 'Ingresá un nombre.')
const optionalAmount = z.string().trim().refine(value => value === '' || Number.isFinite(Number(value.replace(',', '.'))), 'Ingresá un importe válido.')
const positiveAmount = z.string().trim().min(1, 'Ingresá un importe.').refine(value => Number(value.replace(',', '.')) > 0, 'El importe debe ser mayor que cero.')
const optionalDay = z.string().trim().refine(value => value === '' || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 31), 'Ingresá un día entre 1 y 31.')
const optionalLastFour = z.string().trim().refine(value => value === '' || /^\d{4}$/.test(value), 'Ingresá exactamente 4 números.')
const accountTypeSchema = z.enum(['cash', 'bank', 'wallet', 'savings'])
const cardBrandSchema = z.enum(['Visa', 'Mastercard', 'American Express', 'Cabal', 'Naranja X', 'Otra'])

export const onboardingFormSchema = z.object({
  name: requiredName,
  balance: optionalAmount,
  currency: currencySchema,
})

export const movementFormSchema = z.object({
  kind: z.enum(['expense', 'income', 'transfer', 'balance-adjustment']),
  amount: positiveAmount,
  description: z.string().trim(),
  accountId: z.string().min(1, 'Elegí una cuenta.'),
  categoryId: z.string(),
  destinationAccountId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['confirmed', 'pending']),
  adjustmentDirection: z.enum(['credit', 'debit']).optional(),
}).superRefine((value, context) => {
  if ((value.kind === 'expense' || value.kind === 'income') && !value.categoryId) {
    context.addIssue({ code: 'custom', path: ['categoryId'], message: 'Elegí una categoría.' })
  }
  if (value.kind === 'balance-adjustment' && !value.adjustmentDirection) context.addIssue({ code: 'custom', path: ['adjustmentDirection'], message: 'Elegí si el ajuste suma o resta.' })
  if (value.kind === 'transfer' && (!value.destinationAccountId || value.destinationAccountId === value.accountId)) {
    context.addIssue({ code: 'custom', path: ['destinationAccountId'], message: 'Elegí una cuenta de destino distinta.' })
  }
})

export const assetFormSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('account'), name: requiredName, balance: optionalAmount, currency: currencySchema, accountType: accountTypeSchema }),
  z.object({
    mode: z.literal('card'), name: requiredName, issuer: requiredName, brand: cardBrandSchema,
    lastFour: optionalLastFour, closingDay: optionalDay, dueDay: optionalDay, currency: currencySchema,
  }),
])

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>
export type MovementFormValues = z.infer<typeof movementFormSchema>
export type AssetFormValues = z.infer<typeof assetFormSchema>
