import { describe, expect, it } from 'vitest'
import { accountBalance, balancesByCurrency, dashboardIndicators, netWorth } from './engine'
import type { Account, Transaction } from './types'

const accounts: Account[] = [
  { id: 'bank', name: 'Banco', currency: 'ARS', openingBalance: 100_000_00, active: true },
  { id: 'cash', name: 'Efectivo', currency: 'ARS', openingBalance: 10_000_00, active: true },
  { id: 'usd', name: 'Dólares', currency: 'USD', openingBalance: 500_00, active: true },
]

const transactions: Transaction[] = [
  { id: 'salary', date: '2026-10-01', amount: 50_000_00, currency: 'ARS', type: 'income', status: 'confirmed', accountId: 'bank', description: 'Sueldo' },
  { id: 'food', date: '2026-10-02', amount: 5_000_00, currency: 'ARS', type: 'expense', status: 'confirmed', accountId: 'bank', description: 'Supermercado' },
  { id: 'move', date: '2026-10-03', amount: 20_000_00, currency: 'ARS', type: 'transfer', status: 'confirmed', accountId: 'bank', destinationAccountId: 'cash', description: 'Retiro' },
  { id: 'card', date: '2026-10-04', amount: 9_000_00, currency: 'ARS', type: 'card_purchase', status: 'confirmed', description: 'Compra con tarjeta' },
  { id: 'card-pay', date: '2026-10-10', amount: 9_000_00, currency: 'ARS', type: 'card_payment', status: 'confirmed', accountId: 'bank', description: 'Pago resumen' },
  { id: 'rent', date: '2026-10-20', amount: 30_000_00, currency: 'ARS', type: 'expense', status: 'pending', accountId: 'bank', description: 'Alquiler' },
]

describe('motor financiero', () => {
  it('el saldo inicial no cuenta como ingreso y las transferencias conservan patrimonio', () => {
    expect(accountBalance(accounts[0], transactions)).toBe(116_000_00)
    expect(accountBalance(accounts[1], transactions)).toBe(30_000_00)
    expect(balancesByCurrency(accounts, transactions).ARS).toBe(146_000_00)
  })

  it('el pago de tarjeta reduce caja sin duplicar el gasto', () => {
    const result = dashboardIndicators(accounts, transactions, '2026-10', 'ARS')
    expect(result.income).toBe(50_000_00)
    expect(result.expenses).toBe(14_000_00)
    expect(result.monthlyResult).toBe(36_000_00)
    expect(result.confirmedLiquidBalance).toBe(146_000_00)
    expect(result.pendingCommitments).toBe(30_000_00)
    expect(result.projectedBalance).toBe(116_000_00)
  })

  it('calcula patrimonio como activos menos pasivos', () => {
    expect(netWorth(200_000_00, 45_000_00)).toBe(155_000_00)
  })
})
