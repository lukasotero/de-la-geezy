import type { Transaction } from '@/models/entities'

export function analyticsAmountInArs(transaction: Transaction): number | null {
  if (transaction.currency === 'ARS') return transaction.amountMinor
  if (!transaction.effectiveRate || !Number.isFinite(transaction.effectiveRate) || transaction.effectiveRate <= 0) return null
  return Math.round(transaction.amountMinor * transaction.effectiveRate)
}

export function pendingUsdConversionCount(transactions: Transaction[]): number {
  return transactions.filter(transaction => transaction.currency === 'USD' && transaction.type !== 'transfer' && transaction.status !== 'void' && analyticsAmountInArs(transaction) === null).length
}
