import { describe, expect, it } from 'vitest'
import type { Transaction } from '../models'
import { buildMovementSearchIndex, filterMovements, gridColumnsForWidth, hasMovementFilters, movementPage, pageForAnchor, pageSizeForColumns, type MovementFilterState } from './movement-filter'

const stamp = '2026-11-05T12:00:00.000Z'
const movements: Transaction[] = [
  { id: '1', date: '2026-11-01', amountMinor: 1000, currency: 'ARS', type: 'expense', status: 'confirmed', accountId: 'cash', categoryId: 'food', description: 'Café', tags: [], createdAt: stamp, updatedAt: stamp },
  { id: '2', date: '2026-11-05', amountMinor: 2000, currency: 'ARS', type: 'income', status: 'pending', accountId: 'bank', categoryId: 'salary', description: 'Trabajo', tags: [], createdAt: stamp, updatedAt: stamp },
  { id: '3', date: '2026-11-10', amountMinor: 3000, currency: 'ARS', type: 'expense', status: 'confirmed', accountId: 'bank', categoryId: 'food', description: 'Mercado', tags: [], createdAt: stamp, updatedAt: stamp },
]
const categories = new Map([['food', 'Comida'], ['salary', 'Sueldo']])
const defaults: MovementFilterState = { query: '', type: 'all', status: 'all', account: 'all', category: 'all', dateFrom: '', dateTo: '' }

describe('movement filters', () => {
  it('combina texto, selecciones y fechas inclusivas', () => {
    const index = buildMovementSearchIndex(movements, categories)
    expect(filterMovements(index, { ...defaults, query: 'comida', type: 'expense', account: 'cash', dateFrom: '2026-11-01', dateTo: '2026-11-01' })).toEqual([movements[0]])
  })

  it('admite límites de fecha independientes y rangos vacíos', () => {
    const index = buildMovementSearchIndex(movements, categories)
    expect(filterMovements(index, { ...defaults, dateFrom: '2026-11-05' })).toEqual([movements[1], movements[2]])
    expect(filterMovements(index, { ...defaults, dateTo: '2026-11-05' })).toEqual([movements[0], movements[1]])
    expect(filterMovements(index, { ...defaults, dateFrom: '2026-11-11', dateTo: '2026-11-01' })).toEqual([])
  })

  it('considera las fechas como filtros activos', () => {
    expect(hasMovementFilters(defaults)).toBe(false)
    expect(hasMovementFilters({ ...defaults, dateFrom: '2026-11-01' })).toBe(true)
  })
})

describe('movement pagination', () => {
  it('segmenta resultados y corrige páginas fuera de rango', () => {
    const items = Array.from({ length: 51 }, (_, index) => index + 1)
    expect(movementPage(items, 2, 25)).toMatchObject({ items: items.slice(25, 50), page: 2, totalPages: 3, from: 26, to: 50 })
    expect(movementPage(items, 9, 25)).toMatchObject({ items: [51], page: 3, totalPages: 3, from: 51, to: 51 })
  })

  it('adapta columnas y tamaño de página al ancho real', () => {
    expect(gridColumnsForWidth(419)).toBe(1)
    expect(gridColumnsForWidth(846)).toBe(2)
    expect(gridColumnsForWidth(1272)).toBe(3)
    expect(gridColumnsForWidth(2200)).toBe(3)
    expect([1, 2, 3].map(pageSizeForColumns)).toEqual([25, 26, 27])
  })

  it('conserva el primer movimiento visible cuando cambia el tamaño', () => {
    expect(pageForAnchor(50, 26)).toBe(2)
    expect(pageForAnchor(52, 27)).toBe(2)
  })
})
