import { addDays, addMonths, addYears, format, isAfter, parseISO, setDate } from 'date-fns'
import type { RecurringOccurrence, RecurringRule } from './types'

function lastDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function addFrequency(date: Date, rule: RecurringRule): Date {
  if (rule.frequency === 'weekly') return addDays(date, 7)
  const originalDay = parseISO(rule.nextDate).getDate()
  const candidate = rule.frequency === 'monthly'
    ? addMonths(date, 1)
    : rule.frequency === 'quarterly'
      ? addMonths(date, 3)
      : addYears(date, 1)
  return setDate(candidate, Math.min(originalDay, lastDayOfMonth(candidate)))
}

export interface ReconcileResult {
  occurrences: RecurringOccurrence[]
  nextDate: string
}

/** Genera vencimientos hasta hoy. El ID estable ruleId:fecha garantiza idempotencia. */
export function reconcileRecurringRule(
  rule: RecurringRule,
  existing: RecurringOccurrence[],
  today: string,
): ReconcileResult {
  if (!rule.active) return { occurrences: [], nextDate: rule.nextDate }
  const end = rule.endDate ? parseISO(rule.endDate) : undefined
  const todayDate = parseISO(today)
  const existingIds = new Set(existing.map((occurrence) => occurrence.id))
  const occurrences: RecurringOccurrence[] = []
  let cursor = parseISO(rule.nextDate)
  while (!isAfter(cursor, todayDate) && (!end || !isAfter(cursor, end))) {
    const scheduledDate = format(cursor, 'yyyy-MM-dd')
    const id = `${rule.id}:${scheduledDate}`
    if (!existingIds.has(id)) {
      occurrences.push({
        id,
        ruleId: rule.id,
        scheduledDate,
        amount: rule.amount,
        currency: rule.currency,
        status: 'pending',
      })
      existingIds.add(id)
    }
    cursor = addFrequency(cursor, rule)
  }
  return { occurrences, nextDate: format(cursor, 'yyyy-MM-dd') }
}
