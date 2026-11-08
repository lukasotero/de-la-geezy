import { z } from 'zod'

const id = z.string().min(1)
const isoDate = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
const currency = z.enum(['ARS', 'USD'])
const money = z.int()
const audit = { id, createdAt: isoDate, updatedAt: isoDate }

export const accountSchema = z.object({
  ...audit, name: z.string().trim().min(1), type: z.enum(['cash', 'bank', 'wallet', 'savings']),
  currency, initialBalanceMinor: money, active: z.boolean(),
})

export const creditCardSchema = z.object({
  ...audit,
  name: z.string().trim().min(1),
  issuer: z.string().trim().min(1),
  brand: z.enum(['Visa', 'Mastercard', 'American Express', 'Cabal', 'Naranja X', 'Otra']),
  currency,
  closingDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  lastFour: z.string().regex(/^\d{4}$/).optional(),
  limitMinor: money.nonnegative().optional(),
  paymentAccountId: id.optional(),
  active: z.boolean(),
})

export const categorySchema = z.object({
  ...audit, name: z.string().trim().min(1), kind: z.enum(['income', 'expense']), parentId: id.optional(),
  icon: z.string().min(1), color: z.string().regex(/^#[0-9a-f]{6}$/i), order: z.number().int(),
  archived: z.boolean(), system: z.boolean().optional(),
})

export const transactionSchema = z.object({
  ...audit, date: isoDate, amountMinor: money.nonnegative(), currency,
  type: z.enum(['income', 'expense', 'transfer', 'card-payment', 'balance-adjustment', 'debt-payment']),
  status: z.enum(['pending', 'confirmed', 'skipped', 'void']), accountId: id.optional(), destinationAccountId: id.optional(),
  cardId: id.optional(), categoryId: id.optional(), description: z.string().trim().min(1), notes: z.string().optional(),
  tags: z.array(z.string()), relatedId: id.optional(), destinationAmountMinor: money.nonnegative().optional(),
  effectiveRate: z.number().positive().optional(), feeMinor: money.nonnegative().optional(), exchangeRateId: id.optional(),
  source: z.literal('mercado-pago-pdf').optional(), externalId: id.optional(), importBatchId: id.optional(),
  adjustmentDirection: z.enum(['credit', 'debit']).optional(), voidedAt: isoDate.optional(), voidReason: z.string().optional(),
}).superRefine((value, context) => {
  if (value.type === 'transfer' && !value.accountId) {
    context.addIssue({ code: 'custom', message: 'Una transferencia requiere cuenta de origen.' })
  }
  if (value.type === 'balance-adjustment' && !value.adjustmentDirection) {
    context.addIssue({ code: 'custom', path: ['adjustmentDirection'], message: 'Indicá si el ajuste suma o resta saldo.' })
  }
})

export const recurringRuleSchema = z.object({
  ...audit, kind: z.enum(['income', 'expense']), description: z.string().trim().min(1), amountMinor: money.positive(),
  currency, categoryId: id.optional(), suggestedAccountId: id.optional(), frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']),
  interval: z.number().int().positive().optional(), nextDate: isoDate, endDate: isoDate.optional(), autoGenerate: z.boolean(),
  active: z.boolean(),
})

export const debtSchema = z.object({
  ...audit, name: z.string().trim().min(1), creditor: z.string().trim().min(1), initialPrincipalMinor: money.positive(),
  outstandingMinor: money.nonnegative(), currency, dueDate: isoDate.optional(), annualInterestRate: z.number().nonnegative().optional(), active: z.boolean(),
})

export const importBatchSchema = z.object({
  id, source: z.literal('mercado-pago-pdf'), filename: z.string().trim().min(1), fileHash: z.string().regex(/^[0-9a-f]{64}$/),
  periodStart: isoDate, periodEnd: isoDate, importedCount: money.nonnegative(), excludedCount: money.nonnegative(),
  duplicateCount: money.nonnegative(), createdAt: isoDate,
})

