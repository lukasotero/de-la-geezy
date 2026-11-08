import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Category } from '../models/entities'
import { GeezyDatabase } from './database'
import {
  classifyMercadoPagoRows, confirmMercadoPagoImport, parseArgentineMoney, parseMercadoPagoStatement,
  type PdfTextItem, type PdfTextPage,
} from './mercado-pago-import'

const categories: Category[] = [
  { id: 'transport', name: 'Transporte', kind: 'expense', icon: 'Bus', color: '#ffffff', order: 0, archived: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'other', name: 'Otros', kind: 'expense', icon: 'Shapes', color: '#aaaaaa', order: 1, archived: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
]

function item(text: string, x: number, y: number): PdfTextItem { return { text, x, y } }

function page(pageNumber: number, rows: Array<[string, string, string, string]>, heading = pageNumber === 1): PdfTextPage {
  const items = [
    ...(heading ? [item('mercado pago', 20, 600), item('RESUMEN DE CUENTA EN PESOS', 250, 590), item('Periodo:', 250, 560), item('Del 1 al 30 de septiembre de 2026', 290, 560)] : []),
    item('Fecha', 40, 442), item('Descripción', 89, 442), item('ID de la', 197, 445), item('Valor', 312, 442), item('Saldo', 383, 442),
  ]
  rows.forEach(([date, description, operation, amount], index) => {
    const y = 412 - index * 32
    items.push(item(date, 40, y), item(description, 89, y), item(operation, 197, y), item(amount, 290, y), item('$ 1.000,00', 355, y))
  })
  return { pageNumber, width: 446, items }
}

describe('importación de Mercado Pago', () => {
  it('interpreta importes argentinos sin errores binarios', () => {
    expect(parseArgentineMoney('$ -94.000,00')).toBe(-9_400_000)
    expect(parseArgentineMoney('US$ 0,06')).toBe(6)
  })

  it('lee filas de varias páginas e ignora la columna de saldo', () => {
    const statement = parseMercadoPagoStatement([
      page(1, [['01-09-2026', 'Pago Sube viajes', '176649482542', '$ -1.002,80']]),
      page(2, [['02-09-2026', 'Rendimientos', '1749343243811', '$ 3.942,63']], false),
    ], new Date('2026-10-30T12:00:00Z'))
    expect(statement).toMatchObject({ periodStart: '2026-09-01', periodEnd: '2026-09-30' })
    expect(statement.rows).toEqual([
      { date: '2026-09-01', description: 'Pago Sube viajes', externalId: '176649482542', amountMinor: -100280, currency: 'ARS' },
      { date: '2026-09-02', description: 'Rendimientos', externalId: '1749343243811', amountMinor: 394263, currency: 'ARS' },
    ])
  })

  it('mantiene una descripción multilínea dentro de su propia operación', () => {
    const source = page(1, [
      ['01-09-2026', 'Pago Sube viajes', '176649482542', '$ -1.002,80'],
      ['01-09-2026', 'Transferencia enviada Yuzhu', '175741040213', '$ -9.800,00'],
    ])
    const transferDescription = source.items.find(item => item.text === 'Transferencia enviada Yuzhu')!
    transferDescription.y += 7
    const transferIndex = source.items.indexOf(transferDescription)
    source.items.splice(transferIndex + 1, 0, item('Ye', 89, transferDescription.y - 12))

    const statement = parseMercadoPagoStatement([source], new Date('2026-10-30T12:00:00Z'))
    expect(statement.rows.map(row => [row.description, row.externalId, row.amountMinor])).toEqual([
      ['Pago Sube viajes', '176649482542', -100280],
      ['Transferencia enviada Yuzhu Ye', '175741040213', -980000],
    ])
  })

  it('clasifica gastos, transferencias ambiguas y entradas excluidas', () => {
    const classified = classifyMercadoPagoRows([
      { date: '2026-09-01', description: 'Pago Sube viajes', externalId: '1', amountMinor: -100, currency: 'ARS' },
      { date: '2026-09-02', description: 'Transferencia enviada Ana', externalId: '2', amountMinor: -200, currency: 'ARS' },
      { date: '2026-09-03', description: 'Rendimientos', externalId: '3', amountMinor: 300, currency: 'ARS' },
      { date: '2026-09-04', description: 'Inversión Bonos', externalId: '4', amountMinor: -400, currency: 'ARS' },
    ], categories)
    expect(classified.map(row => row.classification)).toEqual(['expense', 'ambiguous-transfer', 'excluded', 'excluded'])
    expect(classified[0].suggestedCategoryId).toBe('transport')
  })

  it('rechaza períodos que todavía no cerraron', () => {
    expect(() => parseMercadoPagoStatement([page(1, [['01-09-2026', 'Pago', '12345678', '$ -1,00']])], new Date('2026-09-15T12:00:00Z'))).toThrow(/períodos cerrados/i)
  })
})

describe('persistencia de la importación', () => {
  const databases: GeezyDatabase[] = []
  afterEach(async () => { await Promise.all(databases.map(async database => { database.close(); await database.delete() })) })

  it('guarda gastos y lote juntos, crea la billetera y bloquea el mismo archivo', async () => {
    const database = new GeezyDatabase(`mp-import-${crypto.randomUUID()}`); databases.push(database)
    const input = {
      filename: 'septiembre.pdf', fileHash: 'a'.repeat(64), periodStart: '2026-09-01', periodEnd: '2026-09-30',
      selectedRows: [{ date: '2026-09-02', description: 'Compra Mercado Libre', externalId: '175916046847', amountMinor: -9_400_000, currency: 'ARS' as const, categoryId: 'other' }],
      excludedCount: 2, duplicateCount: 0, accountsByCurrency: { ARS: { create: true } },
    }
    const result = await confirmMercadoPagoImport(input, database)
    expect(result.importedCount).toBe(1)
    expect(await database.accounts.count()).toBe(1)
    expect(await database.transactions.toArray()).toMatchObject([{ amountMinor: 9_400_000, type: 'expense', source: 'mercado-pago-pdf', externalId: '175916046847' }])
    expect(await database.importBatches.toArray()).toMatchObject([{ importedCount: 1, excludedCount: 2 }])
    await expect(confirmMercadoPagoImport(input, database)).rejects.toThrow(/ya fue importado/i)
  })

  it('fija la venta oficial en gastos USD importados', async () => {
    const database = new GeezyDatabase(`mp-import-usd-${crypto.randomUUID()}`); databases.push(database)
    const stamp = '2026-11-04T12:00:00.000Z'
    await database.exchangeRates.add({ id: 'rate', source: 'dolarapi', rateType: 'official', buy: 1450, sell: 1450, fetchedAt: stamp, createdAt: stamp, updatedAt: stamp })
    await confirmMercadoPagoImport({
      filename: 'usd.pdf', fileHash: 'b'.repeat(64), periodStart: '2026-09-01', periodEnd: '2026-09-30',
      selectedRows: [{ date: '2026-09-02', description: 'Compra USD', externalId: 'usd-1', amountMinor: -60_000, currency: 'USD', categoryId: 'other' }],
      excludedCount: 0, duplicateCount: 0, accountsByCurrency: { USD: { create: true } },
    }, database)
    expect(await database.transactions.toArray()).toMatchObject([{ currency: 'USD', exchangeRateId: 'rate', effectiveRate: 1450 }])
  })
})

