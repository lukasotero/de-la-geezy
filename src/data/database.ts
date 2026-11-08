import Dexie, { type Table } from 'dexie'
import type {
  Account, AppSetting, CardPayment, CardPurchase, CardStatement, Category, CreditCard, Debt, DebtPayment,
  ExchangeRate, Installment, RecurringOccurrence, RecurringRule,
  Transaction, ImportBatch,
} from '../models/entities'

export class GeezyDatabase extends Dexie {
  accounts!: Table<Account, string>
  creditCards!: Table<CreditCard, string>
  categories!: Table<Category, string>
  transactions!: Table<Transaction, string>
  cardPurchases!: Table<CardPurchase, string>
  installments!: Table<Installment, string>
  cardStatements!: Table<CardStatement, string>
  cardPayments!: Table<CardPayment, string>
  recurringRules!: Table<RecurringRule, string>
  recurringOccurrences!: Table<RecurringOccurrence, string>
  debts!: Table<Debt, string>
  debtPayments!: Table<DebtPayment, string>
  exchangeRates!: Table<ExchangeRate, string>
  appSettings!: Table<AppSetting, string>
  importBatches!: Table<ImportBatch, string>

  constructor(name = 'de-la-geezy') {
    super(name)
    this.version(1).stores({
      accounts: 'id, type, currency, active, name',
      creditCards: 'id, currency, active, name',
      categories: 'id, kind, parentId, archived, order, name',
      transactions: 'id, date, type, status, currency, accountId, destinationAccountId, cardId, categoryId, description, relatedId',
      cardPurchases: 'id, cardId, purchaseDate, categoryId',
      installments: 'id, purchaseId, cardId, statementDate, dueDate, status, statementId, [cardId+status]',
      cardStatements: 'id, cardId, period, dueDate, status, [cardId+period]',
      cardPayments: 'id, statementId, cardId, accountId, date, transactionId',
      recurringRules: 'id, nextDate, active, categoryId, suggestedAccountId',
      recurringOccurrences: 'id, ruleId, scheduledDate, status, transactionId, &[ruleId+scheduledDate]',
      debts: 'id, currency, dueDate, active',
      debtPayments: 'id, debtId, accountId, date, transactionId',
      exchangeRates: 'id, source, fetchedAt, rateType',
      reminderDefinitions: 'id, kind, dueDate, dismissed, relatedId',
      appSettings: 'key, updatedAt',
    })

    this.version(2).stores({
      transactions: 'id, date, type, status, currency, accountId, destinationAccountId, cardId, categoryId, description, relatedId, [status+date]',
      exchangeRates: 'id, source, fetchedAt, rateType, [source+fetchedAt]',
    })

    this.version(3).stores({
      transactions: 'id, date, type, status, currency, accountId, destinationAccountId, cardId, categoryId, description, relatedId, [status+date], importBatchId, &[source+currency+externalId]',
      importBatches: 'id, &fileHash, periodStart, periodEnd, createdAt',
    })

    this.version(4).stores({
      savingsGoals: null,
      goalAllocations: null,
    })

    this.version(5).stores({
      transactions: 'id, date, type, status, currency, accountId, destinationAccountId, cardId, categoryId, description, relatedId, [status+date], importBatchId, &[source+currency+externalId], adjustmentDirection',
      recurringRules: 'id, kind, nextDate, active, categoryId, suggestedAccountId',
      recurringOccurrences: 'id, ruleId, scheduledDate, status, transactionId, &[ruleId+scheduledDate]',
      debtPayments: 'id, debtId, accountId, date, transactionId, interestTransactionId',
    }).upgrade(async transaction => {
      await transaction.table('recurringRules').toCollection().modify(rule => { if (!rule.kind) rule.kind = 'expense' })
      await transaction.table('recurringOccurrences').toCollection().modify(occurrence => {
        if (occurrence.expectedAmountMinor === undefined) occurrence.expectedAmountMinor = 0
      })
      await transaction.table('debtPayments').toCollection().modify(payment => { if (payment.feeMinor === undefined) payment.feeMinor = 0 })
    })

    this.version(6).stores({
      cardPurchases: 'id, cardId, purchaseDate, categoryId, status',
      installments: 'id, purchaseId, cardId, statementDate, dueDate, status, statementId, [cardId+status]',
      cardStatements: 'id, cardId, period, dueDate, status, [cardId+period]',
      cardPayments: 'id, statementId, cardId, accountId, date, transactionId, status',
    }).upgrade(async transaction => {
      await transaction.table('cardPurchases').toCollection().modify(purchase => {
        if (!purchase.status) purchase.status = 'active'
      })
      await transaction.table('cardPayments').toCollection().modify(payment => {
        if (!payment.status) payment.status = 'active'
      })
      await transaction.table('transactions').toCollection().modify(movement => {
        if (!movement.status) movement.status = 'confirmed'
      })
    })

    this.version(7).stores({
      reminderDefinitions: null,
    })
  }
}

export const db = new GeezyDatabase()
