import { addMonths, format, isAfter, isBefore, isEqual, parseISO, setDate } from 'date-fns'
import type { Installment, MinorAmount } from './types'
import { assertMinorAmount } from './money'

export function splitInstallments(total: MinorAmount, count: number): MinorAmount[] {
  assertMinorAmount(total)
  if (total <= 0 || !Number.isInteger(count) || count < 1) {
    throw new RangeError('Importe y cantidad de cuotas deben ser positivos')
  }
  const base = Math.floor(total / count)
  const remainder = total % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

function lastDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function dayInMonth(date: Date, day: number): Date {
  return setDate(date, Math.min(day, lastDayOfMonth(date)))
}

/** Determina el primer vencimiento respetando cierre y vencimiento configurados. */
export function firstStatementDueDate(purchaseDate: string, closingDay: number, dueDay: number): string {
  if (![closingDay, dueDay].every((d) => Number.isInteger(d) && d >= 1 && d <= 31)) {
    throw new RangeError('Los días de cierre y vencimiento deben estar entre 1 y 31')
  }
  const purchase = parseISO(purchaseDate)
  const closingThisMonth = dayInMonth(purchase, closingDay)
  const statementMonth = isAfter(purchase, closingThisMonth) ? addMonths(purchase, 1) : purchase
  let due = dayInMonth(statementMonth, dueDay)
  const closing = dayInMonth(statementMonth, closingDay)
  if (isBefore(due, closing) || isEqual(due, closing)) due = dayInMonth(addMonths(statementMonth, 1), dueDay)
  return format(due, 'yyyy-MM-dd')
}

export function buildInstallmentSchedule(
  total: MinorAmount,
  count: number,
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
): Installment[] {
  const firstDue = parseISO(firstStatementDueDate(purchaseDate, closingDay, dueDay))
  return splitInstallments(total, count).map((amount, index) => ({
    number: index + 1,
    amount,
    dueDate: format(dayInMonth(addMonths(firstDue, index), dueDay), 'yyyy-MM-dd'),
    status: 'pending',
  }))
}
