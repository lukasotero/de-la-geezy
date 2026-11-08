import type { Account, Currency, DashboardIndicators, MinorAmount, Transaction } from './types'

function confirmed(transactions: Transaction[]): Transaction[] {
  return transactions.filter((transaction) => transaction.status === 'confirmed')
}

/** Saldo contable confirmado. Compras/pagos de tarjeta no afectan una cuenta salvo el pago. */
export function accountBalance(account: Account, transactions: Transaction[]): MinorAmount {
  return confirmed(transactions).reduce((balance, transaction) => {
    if (transaction.type === 'transfer') {
      if (transaction.accountId === account.id) return balance - transaction.amount - (transaction.fee ?? 0)
      if (transaction.destinationAccountId === account.id) {
        return balance + (transaction.destinationAmount ?? transaction.amount)
      }
      return balance
    }
    if (transaction.accountId !== account.id) return balance
    if (transaction.type === 'income' || transaction.type === 'balance_adjustment') return balance + transaction.amount
    if (transaction.type === 'expense' || transaction.type === 'card_payment') return balance - transaction.amount
    return balance
  }, account.openingBalance)
}

export function balancesByCurrency(
  accounts: Account[],
  transactions: Transaction[],
): Record<Currency, MinorAmount> {
  return accounts.filter((account) => account.active).reduce<Record<Currency, MinorAmount>>(
    (result, account) => {
      result[account.currency] += accountBalance(account, transactions)
      return result
    },
    { ARS: 0, USD: 0 },
  )
}

function isInMonth(date: string, month: string): boolean {
  return date.slice(0, 7) === month
}

/**
 * Indicadores para una moneda sin conversión implícita.
 * Ingreso/gasto incluyen sólo operaciones confirmadas del mes; transferencias y pagos de tarjeta se excluyen.
 */
export function dashboardIndicators(
  accounts: Account[],
  transactions: Transaction[],
  month: string,
  currency: Currency,
): DashboardIndicators {
  const monthly = confirmed(transactions).filter((t) => t.currency === currency && isInMonth(t.date, month))
  const income = monthly.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expenses = monthly
    .filter((t) => t.type === 'expense' || t.type === 'card_purchase')
    .reduce((sum, t) => sum + t.amount, 0)
  const confirmedLiquidBalance = accounts
    .filter((account) => account.active && account.currency === currency)
    .reduce((sum, account) => sum + accountBalance(account, transactions), 0)
  const pendingCommitments = transactions
    .filter((t) => t.currency === currency && t.status === 'pending' && (t.type === 'expense' || t.type === 'card_purchase'))
    .reduce((sum, t) => sum + t.amount, 0)
  return {
    income,
    expenses,
    monthlyResult: income - expenses,
    confirmedLiquidBalance,
    pendingCommitments,
    projectedBalance: confirmedLiquidBalance - pendingCommitments,
  }
}

export function netWorth(assets: MinorAmount, liabilities: MinorAmount): MinorAmount {
  return assets - liabilities
}
