export type Currency = 'ARS' | 'USD'
export type MoneyMinor = number
export type EntityId = string
export type IsoDate = string

export interface AuditFields {
  id: EntityId
  createdAt: IsoDate
  updatedAt: IsoDate
}

export type AccountType = 'cash' | 'bank' | 'wallet' | 'savings'
export interface Account extends AuditFields {
  name: string
  type: AccountType
  currency: Currency
  initialBalanceMinor: MoneyMinor
  active: boolean
}

export interface CreditCard extends AuditFields {
  name: string
  issuer: string
  brand: CardBrand
  currency: Currency
  closingDay?: number
  dueDay?: number
  lastFour?: string
  limitMinor?: MoneyMinor
  paymentAccountId?: EntityId
  active: boolean
}

export type CardBrand = 'Visa' | 'Mastercard' | 'American Express' | 'Cabal' | 'Naranja X' | 'Otra'

export type CategoryKind = 'income' | 'expense'
export interface Category extends AuditFields {
  name: string
  kind: CategoryKind
  parentId?: EntityId
  icon: string
  color: string
  order: number
  archived: boolean
  system?: boolean
}

export type TransactionType = 'income' | 'expense' | 'transfer' | 'card-payment' | 'balance-adjustment' | 'debt-payment'
export type TransactionStatus = 'pending' | 'confirmed' | 'skipped' | 'void'
export interface Transaction extends AuditFields {
  date: IsoDate
  amountMinor: MoneyMinor
  currency: Currency
  type: TransactionType
  status: TransactionStatus
  accountId?: EntityId
  destinationAccountId?: EntityId
  cardId?: EntityId
  categoryId?: EntityId
  description: string
  notes?: string
  tags: string[]
  relatedId?: EntityId
  destinationAmountMinor?: MoneyMinor
  effectiveRate?: number
  feeMinor?: MoneyMinor
  exchangeRateId?: EntityId
  source?: 'mercado-pago-pdf'
  externalId?: string
  importBatchId?: EntityId
  adjustmentDirection?: 'credit' | 'debit'
  voidedAt?: IsoDate
  voidReason?: string
}

export interface ImportBatch {
  id: EntityId
  source: 'mercado-pago-pdf'
  filename: string
  fileHash: string
  periodStart: IsoDate
  periodEnd: IsoDate
  importedCount: number
  excludedCount: number
  duplicateCount: number
  createdAt: IsoDate
}

export interface CardPurchase extends AuditFields {
  cardId: EntityId
  categoryId?: EntityId
  purchaseDate: IsoDate
  description: string
  totalMinor: MoneyMinor
  currency: Currency
  installmentCount: number
  status: 'active' | 'void'
  voidedAt?: IsoDate
  voidReason?: string
}

export type InstallmentStatus = 'pending' | 'statement' | 'paid' | 'void'
export interface Installment extends AuditFields {
  purchaseId: EntityId
  cardId: EntityId
  number: number
  total: number
  amountMinor: MoneyMinor
  statementDate: IsoDate
  dueDate: IsoDate
  status: InstallmentStatus
  statementId?: EntityId
  voidedAt?: IsoDate
  voidReason?: string
}

export interface CardStatement extends AuditFields {
  cardId: EntityId
  period: string
  closingDate: IsoDate
  dueDate: IsoDate
  amountMinor: MoneyMinor
  paidMinor: MoneyMinor
  status: 'open' | 'closed' | 'partial' | 'paid' | 'void'
  voidedAt?: IsoDate
  voidReason?: string
}

export interface CardPayment extends AuditFields {
  statementId: EntityId
  cardId: EntityId
  accountId: EntityId
  date: IsoDate
  amountMinor: MoneyMinor
  currency: Currency
  transactionId: EntityId
  status: 'active' | 'void'
  voidedAt?: IsoDate
  voidReason?: string
}

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
export interface RecurringRule extends AuditFields {
  kind: CategoryKind
  description: string
  amountMinor: MoneyMinor
  currency: Currency
  categoryId?: EntityId
  suggestedAccountId?: EntityId
  frequency: RecurrenceFrequency
  interval?: number
  nextDate: IsoDate
  endDate?: IsoDate
  autoGenerate: boolean
  active: boolean
}

export interface RecurringOccurrence extends AuditFields {
  ruleId: EntityId
  scheduledDate: IsoDate
  transactionId?: EntityId
  status: 'pending' | 'paid' | 'skipped'
  expectedAmountMinor: MoneyMinor
  actualAmountMinor?: MoneyMinor
  effectiveDate?: IsoDate
}

export interface Debt extends AuditFields {
  name: string
  creditor: string
  initialPrincipalMinor: MoneyMinor
  outstandingMinor: MoneyMinor
  currency: Currency
  dueDate?: IsoDate
  annualInterestRate?: number
  active: boolean
}

export interface DebtPayment extends AuditFields {
  debtId: EntityId
  accountId: EntityId
  date: IsoDate
  principalMinor: MoneyMinor
  interestMinor: MoneyMinor
  feeMinor: MoneyMinor
  transactionId: EntityId
  interestTransactionId?: EntityId
}

export interface ExchangeRate extends AuditFields {
  source: 'dolarapi' | 'manual'
  rateType: 'official' | 'custom'
  buy: number
  sell: number
  fetchedAt: IsoDate
  sourceUpdatedAt?: IsoDate
}

export interface AppSetting {
  key: string
  value: unknown
  updatedAt: IsoDate
}

