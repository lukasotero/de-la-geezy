import type { Transaction } from '../models'

const MOVEMENT_CARD_MIN_WIDTH = 420
const MOVEMENT_GRID_GAP = 6

export type MovementFilterState = {
  query: string
  type: string
  status: string
  account: string
  category: string
  dateFrom: string
  dateTo: string
}

export function hasMovementFilters(filters: MovementFilterState) {
  return filters.type !== 'all'
    || filters.status !== 'all'
    || filters.account !== 'all'
    || filters.category !== 'all'
    || Boolean(filters.dateFrom)
    || Boolean(filters.dateTo)
}

export function buildMovementSearchIndex(transactions: Transaction[], categoryNames: Map<string, string>) {
  return transactions.map(transaction => ({
    transaction,
    searchableText: `${transaction.description} ${categoryNames.get(transaction.categoryId ?? '') ?? ''}`.toLocaleLowerCase('es'),
  }))
}

export function filterMovements(searchIndex: ReturnType<typeof buildMovementSearchIndex>, filters: MovementFilterState) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase('es')

  return searchIndex.filter(({ transaction, searchableText }) => {
    if (normalizedQuery && !searchableText.includes(normalizedQuery)) return false
    if (filters.type !== 'all' && transaction.type !== filters.type) return false
    if (filters.status !== 'all' && transaction.status !== filters.status) return false
    if (filters.account !== 'all' && transaction.accountId !== filters.account) return false
    if (filters.category !== 'all' && transaction.categoryId !== filters.category) return false
    if (filters.dateFrom && transaction.date < filters.dateFrom) return false
    if (filters.dateTo && transaction.date > filters.dateTo) return false
    return true
  }).map(({ transaction }) => transaction)
}

export function gridColumnsForWidth(width: number) {
  return Math.min(3, Math.max(1, Math.floor((width + MOVEMENT_GRID_GAP) / (MOVEMENT_CARD_MIN_WIDTH + MOVEMENT_GRID_GAP))))
}

export function pageSizeForColumns(columns: number) {
  if (columns >= 3) return 27
  if (columns === 2) return 26
  return 25
}

export function pageForAnchor(anchorIndex: number, pageSize: number) {
  return Math.floor(Math.max(0, anchorIndex) / pageSize) + 1
}

export function movementPage<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
  }
}
