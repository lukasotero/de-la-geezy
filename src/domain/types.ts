export type Currency = 'ARS' | 'USD'

/** Importe en la unidad mínima de la moneda (centavos para ARS y USD). */
export type MinorAmount = number

export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'card_purchase'
  | 'card_payment'
  | 'balance_adjustment'

export type TransactionStatus = 'pending' | 'confirmed' | 'void'

export interface Account {
  id: string
  name: string
  currency: Currency
  openingBalance: MinorAmount
  active: boolean
}

export interface Transaction {
  id: string
  date: string
  amount: MinorAmount
  currency: Currency
  type: TransactionType
  status: TransactionStatus
  accountId?: string
  destinationAccountId?: string
  categoryId?: string
  description: string
  /** Sólo para transferencias entre monedas. */
  destinationAmount?: MinorAmount
  destinationCurrency?: Currency
  fee?: MinorAmount
  relatedEntityId?: string
}

export interface Installment {
  number: number
  amount: MinorAmount
  dueDate: string
  status: 'pending' | 'paid' | 'void'
}

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface RecurringRule {
  id: string
  description: string
  amount: MinorAmount
  currency: Currency
  frequency: RecurrenceFrequency
  nextDate: string
  endDate?: string
  active: boolean
}

export interface RecurringOccurrence {
  id: string
  ruleId: string
  scheduledDate: string
  amount: MinorAmount
  currency: Currency
  status: 'pending' | 'paid' | 'skipped'
}

export interface DashboardIndicators {
  income: MinorAmount
  expenses: MinorAmount
  monthlyResult: MinorAmount
  confirmedLiquidBalance: MinorAmount
  pendingCommitments: MinorAmount
  projectedBalance: MinorAmount
}
