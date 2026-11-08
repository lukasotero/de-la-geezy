import { addDays, addMonths, addYears, format, isAfter, parseISO, setDate } from 'date-fns'
import { buildInstallmentSchedule } from '@/domain/installments'
import { toMinorUnits } from '@/domain/money'
import type {
  CardPayment, CardPurchase, CardStatement, CategoryKind, Currency, Debt, DebtPayment, ExchangeRate, Installment,
  RecurringOccurrence, RecurringRule, Transaction, TransactionStatus,
} from '@/models/entities'
import { debtSchema, recurringRuleSchema, transactionSchema } from '@/models/schemas'
import { db, type GeezyDatabase } from './database'
import { historicalRateFields, latestOfficialRate } from './exchange-rate'

export type FinanceErrorCode = 'NOT_FOUND' | 'INVALID_RELATION' | 'CURRENCY_MISMATCH' | 'INSUFFICIENT_BALANCE' | 'INVALID_AMOUNT'

export class FinanceError extends Error {
  constructor(readonly code: FinanceErrorCode, message: string) { super(message); this.name = 'FinanceError' }
}

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
const now = () => new Date().toISOString()

export type MovementInput = {
  date: string; amount: string | number; currency: Currency; type: 'income' | 'expense' | 'balance-adjustment';
  status: TransactionStatus; accountId: string; categoryId?: string; description: string; notes?: string; tags?: string[];
  adjustmentDirection?: 'credit' | 'debit'
}

export type TransferInput = {
  date: string; originAccountId: string; destinationAccountId: string; amount: string | number;
  destinationAmount?: string | number; fee?: string | number; exchangeRateId?: string; description?: string
}

export type CardPurchaseInput = {
  cardId: string; categoryId?: string; purchaseDate: string; description: string; amount: string | number; installmentCount: number
}

export type CardPaymentInput = { accountId: string; date: string; amount: string | number }

export type DebtPaymentInput = {
  debtId: string; accountId: string; date: string; principal: string | number; interest?: string | number; fee?: string | number
}

function positiveMinor(value: string | number, label = 'El importe'): number {
  const amount = toMinorUnits(value)
  if (amount <= 0) throw new FinanceError('INVALID_AMOUNT', `${label} debe ser mayor que cero.`)
  return amount
}

function optionalMinor(value?: string | number): number {
  if (value === undefined || value === '') return 0
  return positiveMinor(value)
}

export class FinanceService {
  constructor(readonly database: GeezyDatabase = db) {}

  private async historicalRate(currency: Currency): Promise<Pick<Transaction, 'exchangeRateId' | 'effectiveRate'>> {
    return currency === 'USD' ? historicalRateFields(await latestOfficialRate(this.database)) : {}
  }

  async reconcileUsdRates(rate?: ExchangeRate): Promise<number> {
    const official = rate ?? await latestOfficialRate(this.database)
    if (!official) return 0
    const missing = (await this.database.transactions.where('currency').equals('USD').toArray())
      .filter(transaction => transaction.type !== 'transfer' && transaction.status !== 'void' && !transaction.effectiveRate)
    if (!missing.length) return 0
    const stamp = now()
    await this.database.transactions.bulkPut(missing.map(transaction => ({ ...transaction, ...historicalRateFields(official), updatedAt: stamp })))
    return missing.length
  }

  async createMovement(input: MovementInput): Promise<Transaction> {
    const stamp = now()
    const account = await this.database.accounts.get(input.accountId)
    if (!account) throw new FinanceError('NOT_FOUND', 'La cuenta no existe.')
    if (account.currency !== input.currency) throw new FinanceError('CURRENCY_MISMATCH', 'La moneda no coincide con la cuenta.')
    const rateFields = await this.historicalRate(input.currency)
    const transaction = transactionSchema.parse({
      id: uid(), date: input.date, amountMinor: positiveMinor(input.amount), currency: input.currency, type: input.type,
      status: input.status, accountId: input.accountId, categoryId: input.categoryId, description: input.description.trim(),
      notes: input.notes?.trim() || undefined, tags: input.tags ?? [], adjustmentDirection: input.adjustmentDirection, ...rateFields,
      createdAt: stamp, updatedAt: stamp,
    }) as Transaction
    await this.database.transactions.add(transaction)
    return transaction
  }

  async updateMovement(id: string, input: MovementInput): Promise<Transaction> {
    const current = await this.database.transactions.get(id)
    if (!current) throw new FinanceError('NOT_FOUND', 'El movimiento no existe.')
    if (current.relatedId || current.cardId || current.type === 'card-payment' || current.type === 'debt-payment') {
      throw new FinanceError('INVALID_RELATION', 'Este movimiento debe editarse desde su operación de origen.')
    }
    const account = await this.database.accounts.get(input.accountId)
    if (!account) throw new FinanceError('NOT_FOUND', 'La cuenta no existe.')
    const rateFields = input.currency === 'ARS'
      ? { exchangeRateId: undefined, effectiveRate: undefined }
      : current.currency === 'USD' && current.effectiveRate
        ? { exchangeRateId: current.exchangeRateId, effectiveRate: current.effectiveRate }
        : await this.historicalRate('USD')
    const updated = transactionSchema.parse({ ...current, ...input, ...rateFields, amountMinor: positiveMinor(input.amount), updatedAt: now() }) as Transaction
    await this.database.transactions.put(updated)
    return updated
  }

  async deleteMovement(id: string): Promise<void> {
    const movement = await this.database.transactions.get(id)
    if (!movement) return
    if (movement.cardId || movement.type === 'card-payment' || movement.type === 'debt-payment') {
      throw new FinanceError('INVALID_RELATION', 'Eliminá la operación desde tarjetas o deudas.')
    }
    await this.database.transactions.delete(id)
  }

  async createTransfer(input: TransferInput): Promise<Transaction> {
    const [origin, destination] = await Promise.all([
      this.database.accounts.get(input.originAccountId), this.database.accounts.get(input.destinationAccountId),
    ])
    if (!origin || !destination) throw new FinanceError('NOT_FOUND', 'Una de las cuentas no existe.')
    if (origin.id === destination.id) throw new FinanceError('INVALID_RELATION', 'Elegí dos cuentas distintas.')
    const amountMinor = positiveMinor(input.amount)
    let exchangeRateId = input.exchangeRateId
    let destinationAmountMinor = amountMinor
    if (origin.currency !== destination.currency) {
      if (input.destinationAmount !== undefined && input.destinationAmount !== '') destinationAmountMinor = positiveMinor(input.destinationAmount)
      else {
        const officialRates = await this.database.exchangeRates.where('source').equals('dolarapi').toArray()
        const rate = officialRates.reduce<ExchangeRate | undefined>((latest, candidate) => !latest || candidate.fetchedAt > latest.fetchedAt ? candidate : latest, undefined)
        if (!rate) throw new FinanceError('INVALID_RELATION', 'No hay una cotización oficial disponible. Conectate a internet y actualizala antes de transferir entre monedas.')
        exchangeRateId = rate.id
        destinationAmountMinor = origin.currency === 'USD' ? Math.round(amountMinor * rate.sell) : Math.round(amountMinor / rate.sell)
      }
    }
    const feeMinor = optionalMinor(input.fee)
    const stamp = now()
    const movement = transactionSchema.parse({
      id: uid(), date: input.date, amountMinor, destinationAmountMinor, currency: origin.currency, type: 'transfer', status: 'confirmed',
      accountId: origin.id, destinationAccountId: destination.id, description: input.description?.trim() || 'Transferencia', tags: [],
      effectiveRate: origin.currency === destination.currency ? 1 : destinationAmountMinor / amountMinor,
      feeMinor, exchangeRateId, createdAt: stamp, updatedAt: stamp,
    }) as Transaction
    await this.database.transactions.add(movement)
    return movement
  }

  async createCardPurchase(input: CardPurchaseInput): Promise<{ purchase: CardPurchase; installments: Installment[] }> {
    const card = await this.database.creditCards.get(input.cardId)
    if (!card) throw new FinanceError('NOT_FOUND', 'La tarjeta no existe.')
    if (!card.closingDay || !card.dueDay) throw new FinanceError('INVALID_RELATION', 'Completá cierre y vencimiento de la tarjeta.')
    const totalMinor = positiveMinor(input.amount)
    const rateFields = await this.historicalRate(card.currency)
    const stamp = now(); const purchaseId = uid()
    const purchase: CardPurchase = { id: purchaseId, cardId: card.id, categoryId: input.categoryId, purchaseDate: input.purchaseDate,
      description: input.description.trim(), totalMinor, currency: card.currency, installmentCount: input.installmentCount, status: 'active', createdAt: stamp, updatedAt: stamp }
    const schedule = buildInstallmentSchedule(totalMinor, input.installmentCount, input.purchaseDate, card.closingDay, card.dueDay)
    const installments: Installment[] = schedule.map(item => ({ id: uid(), purchaseId, cardId: card.id, number: item.number, total: input.installmentCount,
      amountMinor: item.amount, statementDate: item.dueDate.slice(0, 7), dueDate: item.dueDate, status: 'pending', createdAt: stamp, updatedAt: stamp }))
    const expense: Transaction = { id: uid(), date: input.purchaseDate, amountMinor: totalMinor, currency: card.currency, type: 'expense', status: 'confirmed',
      cardId: card.id, categoryId: input.categoryId, description: input.description.trim(), tags: [], relatedId: purchaseId, ...rateFields, createdAt: stamp, updatedAt: stamp }
    await this.database.transaction('rw', [this.database.cardPurchases, this.database.installments, this.database.transactions], async () => {
      await this.database.cardPurchases.add(purchase); await this.database.installments.bulkAdd(installments); await this.database.transactions.add(expense)
    })
    return { purchase, installments }
  }

  private async activePaymentsForStatements(statementIds: string[]): Promise<CardPayment[]> {
    if (!statementIds.length) return []
    const idSet = new Set(statementIds)
    return (await this.database.cardPayments.toArray()).filter(payment => idSet.has(payment.statementId) && payment.status !== 'void')
  }

  private async statementIdsForPurchase(purchaseId: string): Promise<string[]> {
    const installments = await this.database.installments.where('purchaseId').equals(purchaseId).toArray()
    return [...new Set(installments.flatMap(item => item.statementId ? [item.statementId] : []))]
  }

  async recalculateStatement(statementId: string): Promise<CardStatement> {
    const statement = await this.database.cardStatements.get(statementId)
    if (!statement) throw new FinanceError('NOT_FOUND', 'El resumen no existe.')
    const [installments, payments] = await Promise.all([
      this.database.installments.where('statementId').equals(statementId).toArray(),
      this.database.cardPayments.where('statementId').equals(statementId).toArray(),
    ])
    const activeInstallments = installments.filter(item => item.status !== 'void')
    const amountMinor = activeInstallments.reduce((sum, item) => sum + item.amountMinor, 0)
    const paidMinor = payments.filter(item => item.status !== 'void').reduce((sum, item) => sum + item.amountMinor, 0)
    if (paidMinor > amountMinor) throw new FinanceError('INVALID_AMOUNT', 'Los pagos activos superan el total del resumen.')
    const stamp = now()
    const status: CardStatement['status'] = amountMinor === 0 ? 'void' : paidMinor === amountMinor ? 'paid' : paidMinor > 0 ? 'partial' : 'open'
    const updated: CardStatement = {
      ...statement, amountMinor, paidMinor, status, updatedAt: stamp,
      voidedAt: status === 'void' ? statement.voidedAt ?? stamp : undefined,
      voidReason: status === 'void' ? statement.voidReason ?? 'Sin cuotas activas.' : undefined,
    }
    await this.database.cardStatements.put(updated)
    if (activeInstallments.length) {
      await this.database.installments.bulkPut(activeInstallments.map(item => ({
        ...item, status: status === 'paid' ? 'paid' as const : 'statement' as const, updatedAt: stamp,
      })))
    }
    return updated
  }

  async updateCardPurchase(id: string, input: CardPurchaseInput): Promise<{ purchase: CardPurchase; installments: Installment[] }> {
    const [current, card] = await Promise.all([this.database.cardPurchases.get(id), this.database.creditCards.get(input.cardId)])
    if (!current || current.status === 'void') throw new FinanceError('NOT_FOUND', 'La compra activa no existe.')
    if (!card) throw new FinanceError('NOT_FOUND', 'La tarjeta no existe.')
    if (!card.closingDay || !card.dueDay) throw new FinanceError('INVALID_RELATION', 'Completá cierre y vencimiento de la tarjeta.')
    const statementIds = await this.statementIdsForPurchase(id)
    if ((await this.activePaymentsForStatements(statementIds)).length) {
      throw new FinanceError('INVALID_RELATION', 'Revertí primero los pagos activos de los resúmenes relacionados.')
    }
    const totalMinor = positiveMinor(input.amount)
    const stamp = now()
    const schedule = buildInstallmentSchedule(totalMinor, input.installmentCount, input.purchaseDate, card.closingDay, card.dueDay)
    const installments: Installment[] = schedule.map(item => ({
      id: uid(), purchaseId: id, cardId: card.id, number: item.number, total: input.installmentCount, amountMinor: item.amount,
      statementDate: item.dueDate.slice(0, 7), dueDate: item.dueDate, status: 'pending', createdAt: stamp, updatedAt: stamp,
    }))
    const purchase: CardPurchase = {
      ...current, cardId: card.id, categoryId: input.categoryId, purchaseDate: input.purchaseDate, description: input.description.trim(),
      totalMinor, currency: card.currency, installmentCount: input.installmentCount, updatedAt: stamp,
    }
    const currentExpense = await this.database.transactions.where('relatedId').equals(id).first()
    if (!currentExpense) throw new FinanceError('INVALID_RELATION', 'No se encontró el consumo relacionado.')
    const rateFields = card.currency === 'ARS'
      ? { exchangeRateId: undefined, effectiveRate: undefined }
      : currentExpense.currency === 'USD' && currentExpense.effectiveRate
        ? { exchangeRateId: currentExpense.exchangeRateId, effectiveRate: currentExpense.effectiveRate }
        : await this.historicalRate('USD')
    await this.database.transaction('rw', [this.database.cardPurchases, this.database.installments, this.database.transactions, this.database.cardStatements, this.database.cardPayments], async () => {
      const oldInstallments = await this.database.installments.where('purchaseId').equals(id).toArray()
      await this.database.installments.bulkPut(oldInstallments.filter(item => item.status !== 'void').map(item => ({ ...item, status: 'void', voidedAt: stamp, voidReason: 'Cronograma reemplazado.', updatedAt: stamp })))
      await this.database.installments.bulkAdd(installments)
      await this.database.cardPurchases.put(purchase)
      await this.database.transactions.put({ ...currentExpense, ...rateFields, date: input.purchaseDate, amountMinor: totalMinor, currency: card.currency, cardId: card.id,
        categoryId: input.categoryId, description: input.description.trim(), status: 'confirmed', voidedAt: undefined, voidReason: undefined, updatedAt: stamp })
      await Promise.all(statementIds.map(statementId => this.recalculateStatement(statementId)))
      await this.buildStatements()
    })
    return { purchase, installments }
  }

  async voidCardPurchase(id: string, reason?: string): Promise<void> {
    const purchase = await this.database.cardPurchases.get(id)
    if (!purchase || purchase.status === 'void') return
    const statementIds = await this.statementIdsForPurchase(id)
    const activePayments = await this.activePaymentsForStatements(statementIds)
    if (activePayments.length) throw new FinanceError('INVALID_RELATION', `Revertí primero ${activePayments.length} pago${activePayments.length === 1 ? '' : 's'} activo${activePayments.length === 1 ? '' : 's'}.`)
    const stamp = now(); const voidReason = reason?.trim() || 'Compra anulada.'
    await this.database.transaction('rw', [this.database.cardPurchases, this.database.installments, this.database.transactions, this.database.cardStatements, this.database.cardPayments], async () => {
      const installments = await this.database.installments.where('purchaseId').equals(id).toArray()
      await this.database.cardPurchases.put({ ...purchase, status: 'void', voidedAt: stamp, voidReason, updatedAt: stamp })
      await this.database.installments.bulkPut(installments.filter(item => item.status !== 'void').map(item => ({ ...item, status: 'void', voidedAt: stamp, voidReason, updatedAt: stamp })))
      const expense = await this.database.transactions.where('relatedId').equals(id).first()
      if (expense) await this.database.transactions.put({ ...expense, status: 'void', voidedAt: stamp, voidReason, updatedAt: stamp })
      await Promise.all(statementIds.map(statementId => this.recalculateStatement(statementId)))
    })
  }

  async buildStatements(): Promise<CardStatement[]> {
    const pending = await this.database.installments.where('status').equals('pending').toArray()
    const created: CardStatement[] = []
    await this.database.transaction('rw', [this.database.cardStatements, this.database.installments, this.database.cardPayments], async () => {
      const existingStatements = await this.database.cardStatements.toArray()
      const statementsByCycle = new Map(existingStatements.map(statement => [`${statement.cardId}:${statement.period}`, statement]))
      const affected = new Set<string>()
      const linked: Installment[] = []
      for (const installment of pending) {
        const period = installment.dueDate.slice(0, 7); const key = `${installment.cardId}:${period}`; const existing = statementsByCycle.get(key)
        const stamp = now(); const statement: CardStatement = existing ?? { id: uid(), cardId: installment.cardId, period, closingDate: `${period}-01`, dueDate: installment.dueDate,
          amountMinor: 0, paidMinor: 0, status: 'open', createdAt: stamp, updatedAt: stamp }
        if (!existing) { statementsByCycle.set(key, statement); created.push(statement) }
        linked.push({ ...installment, statementId: statement.id, status: 'statement', updatedAt: stamp })
        affected.add(statement.id)
      }
      if (created.length) await this.database.cardStatements.bulkAdd(created)
      if (linked.length) await this.database.installments.bulkPut(linked)
      await Promise.all([...affected].map(statementId => this.recalculateStatement(statementId)))
    })
    return created
  }

  async payCard(statementId: string, accountId: string, amount: string | number, date: string): Promise<CardPayment> {
    const [statement, account] = await Promise.all([this.database.cardStatements.get(statementId), this.database.accounts.get(accountId)])
    if (!statement || !account) throw new FinanceError('NOT_FOUND', 'No encontramos el resumen o la cuenta.')
    const card = await this.database.creditCards.get(statement.cardId)
    if (!card || card.currency !== account.currency) throw new FinanceError('CURRENCY_MISMATCH', 'La cuenta debe usar la moneda de la tarjeta.')
    const amountMinor = positiveMinor(amount); const remaining = statement.amountMinor - statement.paidMinor
    if (amountMinor > remaining) throw new FinanceError('INVALID_AMOUNT', 'El pago supera el saldo del resumen.')
    const stamp = now(); const transactionId = uid(); const rateFields = await this.historicalRate(card.currency)
    const transaction: Transaction = { id: transactionId, date, amountMinor, currency: card.currency, type: 'card-payment', status: 'confirmed', accountId,
      cardId: card.id, description: `Pago ${card.name}`, tags: [], relatedId: statement.id, ...rateFields, createdAt: stamp, updatedAt: stamp }
    const payment: CardPayment = { id: uid(), statementId, cardId: card.id, accountId, date, amountMinor, currency: card.currency, transactionId, status: 'active', createdAt: stamp, updatedAt: stamp }
    await this.database.transaction('rw', [this.database.transactions, this.database.cardPayments, this.database.cardStatements, this.database.installments], async () => {
      await this.database.transactions.add(transaction); await this.database.cardPayments.add(payment)
      await this.recalculateStatement(statementId)
    })
    return payment
  }

  async updateCardPayment(id: string, input: CardPaymentInput): Promise<CardPayment> {
    const payment = await this.database.cardPayments.get(id)
    if (!payment || payment.status === 'void') throw new FinanceError('NOT_FOUND', 'El pago activo no existe.')
    const [statement, account] = await Promise.all([this.database.cardStatements.get(payment.statementId), this.database.accounts.get(input.accountId)])
    if (!statement || !account) throw new FinanceError('NOT_FOUND', 'No encontramos el resumen o la cuenta.')
    const card = await this.database.creditCards.get(statement.cardId)
    if (!card || account.currency !== card.currency) throw new FinanceError('CURRENCY_MISMATCH', 'La cuenta debe usar la moneda de la tarjeta.')
    const amountMinor = positiveMinor(input.amount)
    const otherPaid = (await this.database.cardPayments.where('statementId').equals(statement.id).toArray())
      .filter(item => item.id !== id && item.status !== 'void').reduce((sum, item) => sum + item.amountMinor, 0)
    if (otherPaid + amountMinor > statement.amountMinor) throw new FinanceError('INVALID_AMOUNT', 'El pago supera el saldo del resumen.')
    const stamp = now(); const updated: CardPayment = { ...payment, accountId: account.id, date: input.date, amountMinor, updatedAt: stamp }
    await this.database.transaction('rw', [this.database.cardPayments, this.database.transactions, this.database.cardStatements, this.database.installments], async () => {
      const movement = await this.database.transactions.get(payment.transactionId)
      if (!movement) throw new FinanceError('INVALID_RELATION', 'No se encontró el movimiento de caja relacionado.')
      await this.database.cardPayments.put(updated)
      await this.database.transactions.put({ ...movement, accountId: account.id, date: input.date, amountMinor, updatedAt: stamp })
      await this.recalculateStatement(statement.id)
    })
    return updated
  }

  async voidCardPayment(id: string, reason?: string): Promise<void> {
    const payment = await this.database.cardPayments.get(id)
    if (!payment || payment.status === 'void') return
    const stamp = now(); const voidReason = reason?.trim() || 'Pago anulado.'
    await this.database.transaction('rw', [this.database.cardPayments, this.database.transactions, this.database.cardStatements, this.database.installments], async () => {
      const movement = await this.database.transactions.get(payment.transactionId)
      if (!movement) throw new FinanceError('INVALID_RELATION', 'No se encontró el movimiento de caja relacionado.')
      await this.database.cardPayments.put({ ...payment, status: 'void', voidedAt: stamp, voidReason, updatedAt: stamp })
      await this.database.transactions.put({ ...movement, status: 'void', voidedAt: stamp, voidReason, updatedAt: stamp })
      await this.recalculateStatement(payment.statementId)
    })
  }

  async saveRecurringRule(input: Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<RecurringRule> {
    const current = id ? await this.database.recurringRules.get(id) : undefined; const stamp = now()
    const rule = recurringRuleSchema.parse({ ...input, id: id ?? uid(), createdAt: current?.createdAt ?? stamp, updatedAt: stamp }) as RecurringRule
    await this.database.recurringRules.put(rule); return rule
  }

  async reconcileRecurring(today = format(new Date(), 'yyyy-MM-dd')): Promise<number> {
    const rules = (await this.database.recurringRules.toArray()).filter(rule => rule.active); let count = 0
    for (const rule of rules) {
      let cursor = parseISO(rule.nextDate); const end = rule.endDate ? parseISO(rule.endDate) : undefined; const occurrences: RecurringOccurrence[] = []
      while (!isAfter(cursor, parseISO(today)) && (!end || !isAfter(cursor, end))) {
        const scheduledDate = format(cursor, 'yyyy-MM-dd'); const id = `${rule.id}:${scheduledDate}`
        if (!await this.database.recurringOccurrences.get(id)) occurrences.push({ id, ruleId: rule.id, scheduledDate, expectedAmountMinor: rule.amountMinor,
          status: 'pending', createdAt: now(), updatedAt: now() })
        const day = parseISO(rule.nextDate).getDate(); const interval = rule.interval ?? 1
        if (rule.frequency === 'weekly') cursor = addDays(cursor, 7 * interval)
        else if (rule.frequency === 'yearly') cursor = addYears(cursor, interval)
        else { const months = rule.frequency === 'quarterly' ? 3 * interval : interval; const candidate = addMonths(cursor, months); const last = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate(); cursor = setDate(candidate, Math.min(day, last)) }
      }
      if (occurrences.length) await this.database.recurringOccurrences.bulkAdd(occurrences)
      await this.database.recurringRules.put({ ...rule, nextDate: format(cursor, 'yyyy-MM-dd'), updatedAt: now() }); count += occurrences.length
    }
    return count
  }

  async resolveOccurrence(id: string, action: 'confirm' | 'skip', options?: { amount?: string | number; date?: string; accountId?: string }): Promise<void> {
    const occurrence = await this.database.recurringOccurrences.get(id); if (!occurrence) throw new FinanceError('NOT_FOUND', 'La ocurrencia no existe.')
    if (action === 'skip') { await this.database.recurringOccurrences.put({ ...occurrence, status: 'skipped', updatedAt: now() }); return }
    const rule = await this.database.recurringRules.get(occurrence.ruleId); if (!rule || !options?.accountId) throw new FinanceError('INVALID_RELATION', 'Falta la regla o la cuenta.')
    const movement = await this.createMovement({ date: options.date ?? occurrence.scheduledDate, amount: options.amount ?? rule.amountMinor / 100,
      currency: rule.currency, type: rule.kind, status: 'confirmed', accountId: options.accountId, categoryId: rule.categoryId, description: rule.description })
    await this.database.recurringOccurrences.put({ ...occurrence, status: 'paid', transactionId: movement.id, actualAmountMinor: movement.amountMinor,
      effectiveDate: movement.date, updatedAt: now() })
  }

  async rescheduleOccurrence(id: string, scheduledDate: string): Promise<RecurringOccurrence> {
    const occurrence = await this.database.recurringOccurrences.get(id)
    if (!occurrence || occurrence.status !== 'pending') throw new FinanceError('INVALID_RELATION', 'Sólo se puede reprogramar una ocurrencia pendiente.')
    const nextId = `${occurrence.ruleId}:${scheduledDate}`
    const next = { ...occurrence, id: nextId, scheduledDate, updatedAt: now() }
    await this.database.transaction('rw', this.database.recurringOccurrences, async () => {
      await this.database.recurringOccurrences.delete(id); await this.database.recurringOccurrences.put(next)
    })
    return next
  }

  async saveDebt(input: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<Debt> {
    const current = id ? await this.database.debts.get(id) : undefined; const stamp = now()
    const debt = debtSchema.parse({ ...input, id: id ?? uid(), createdAt: current?.createdAt ?? stamp, updatedAt: stamp }) as Debt
    await this.database.debts.put(debt); return debt
  }

  async payDebt(input: DebtPaymentInput): Promise<DebtPayment> {
    const [debt, account] = await Promise.all([this.database.debts.get(input.debtId), this.database.accounts.get(input.accountId)])
    if (!debt || !account) throw new FinanceError('NOT_FOUND', 'No encontramos la deuda o la cuenta.')
    if (debt.currency !== account.currency) throw new FinanceError('CURRENCY_MISMATCH', 'La cuenta debe usar la moneda de la deuda.')
    const principalMinor = positiveMinor(input.principal, 'El capital'); const interestMinor = optionalMinor(input.interest); const feeMinor = optionalMinor(input.fee)
    if (principalMinor > debt.outstandingMinor) throw new FinanceError('INVALID_AMOUNT', 'El capital supera la deuda pendiente.')
    const stamp = now(); const transactionId = uid(); const interestTransactionId = interestMinor + feeMinor > 0 ? uid() : undefined
    const rateFields = await this.historicalRate(debt.currency)
    const payment: DebtPayment = { id: uid(), debtId: debt.id, accountId: account.id, date: input.date, principalMinor, interestMinor, feeMinor,
      transactionId, interestTransactionId, createdAt: stamp, updatedAt: stamp }
    const movements: Transaction[] = [{ id: transactionId, date: input.date, amountMinor: principalMinor, currency: debt.currency, type: 'debt-payment', status: 'confirmed',
      accountId: account.id, description: `Capital ${debt.name}`, tags: [], relatedId: payment.id, ...rateFields, createdAt: stamp, updatedAt: stamp }]
    if (interestTransactionId) movements.push({ id: interestTransactionId, date: input.date, amountMinor: interestMinor + feeMinor, currency: debt.currency, type: 'expense', status: 'confirmed',
      accountId: account.id, description: `Intereses y cargos ${debt.name}`, tags: [], relatedId: payment.id, ...rateFields, createdAt: stamp, updatedAt: stamp })
    await this.database.transaction('rw', [this.database.debts, this.database.debtPayments, this.database.transactions], async () => {
      await this.database.debtPayments.add(payment); await this.database.transactions.bulkAdd(movements)
      const outstandingMinor = debt.outstandingMinor - principalMinor; await this.database.debts.put({ ...debt, outstandingMinor, active: outstandingMinor > 0, updatedAt: stamp })
    })
    return payment
  }
}

export const financeService = new FinanceService()
