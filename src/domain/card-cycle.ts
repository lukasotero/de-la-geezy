export type CardCycle = {
  closingDate: Date
  dueDate: Date
}

function dateForDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0, 12).getDate()
  return new Date(year, month, Math.min(day, lastDay), 12)
}

function addMonths(date: Date, months: number, day: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1, 12)
  return dateForDay(target.getFullYear(), target.getMonth(), day)
}

function dueDateForClosing(closingDate: Date, closingDay: number, dueDay: number) {
  const monthOffset = dueDay <= closingDay ? 1 : 0
  return addMonths(closingDate, monthOffset, dueDay)
}

/** Returns the open or next card cycle for the supplied civil date. */
export function getCardCycle(closingDay: number, dueDay: number, today = new Date()): CardCycle {
  const civilToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  const closingThisMonth = dateForDay(civilToday.getFullYear(), civilToday.getMonth(), closingDay)
  let closingDate = civilToday >= closingThisMonth ? closingThisMonth : addMonths(closingThisMonth, -1, closingDay)
  let dueDate = dueDateForClosing(closingDate, closingDay, dueDay)

  if (civilToday > dueDate) {
    closingDate = addMonths(closingDate, 1, closingDay)
    dueDate = dueDateForClosing(closingDate, closingDay, dueDay)
  }

  return { closingDate, dueDate }
}

export function formatCardDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}
