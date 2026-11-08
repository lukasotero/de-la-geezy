import type { Account, Category, Currency, ImportBatch, Transaction } from '../models/entities'
import { importBatchSchema, transactionSchema } from '../models/schemas'
import { db, type GeezyDatabase } from './database'
import { historicalRateFields, latestOfficialRate } from './exchange-rate'

export interface PdfTextItem {
  text: string
  x: number
  y: number
}

export interface PdfTextPage {
  pageNumber: number
  width: number
  items: PdfTextItem[]
}

export interface MercadoPagoRow {
  date: string
  description: string
  externalId: string
  amountMinor: number
  currency: Currency
}

export interface MercadoPagoStatement {
  periodStart: string
  periodEnd: string
  rows: MercadoPagoRow[]
}

type ImportClassification = 'expense' | 'ambiguous-transfer' | 'excluded'

export interface ClassifiedMercadoPagoRow extends MercadoPagoRow {
  classification: ImportClassification
  suggestedCategoryId: string
}

interface SelectedImportRow extends MercadoPagoRow {
  categoryId: string
}

interface ImportAccountChoice {
  accountId?: string
  create: boolean
}

export interface ConfirmMercadoPagoImportInput {
  filename: string
  fileHash: string
  periodStart: string
  periodEnd: string
  selectedRows: SelectedImportRow[]
  excludedCount: number
  duplicateCount: number
  accountsByCurrency: Partial<Record<Currency, ImportAccountChoice>>
}

export interface ImportResult {
  batchId: string
  importedCount: number
  duplicateCount: number
  createdAccounts: Account[]
}

const DATE_PATTERN = /^\d{2}-\d{2}-\d{4}$/
const OPERATION_PATTERN = /^\d{8,}$/
const MONEY_PATTERN = /^(?:US\$|\$)\s*-?[\d.]+,\d{2}$/
const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function toIsoDate(value: string): string {
  const [day, month, year] = value.split('-')
  return `${year}-${month}-${day}`
}

export function parseArgentineMoney(value: string): number {
  const normalized = value.replace(/US\$|\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const amount = Number(normalized)
  if (!Number.isFinite(amount)) throw new Error(`No se pudo interpretar el importe “${value}”.`)
  return Math.round(amount * 100)
}

function parsePeriod(pages: PdfTextPage[]): { start: string; end: string } {
  const header = pages.slice(0, 1).flatMap(page => page.items).map(item => item.text).join(' ')
  const match = header.match(/Del\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i)
  if (!match) throw new Error('No encontramos el período del resumen. Verificá que sea un PDF de Mercado Pago con texto seleccionable.')
  const month = SPANISH_MONTHS[normalize(match[3])]
  if (!month) throw new Error('El mes informado por Mercado Pago no es válido.')
  const prefix = `${match[4]}-${String(month).padStart(2, '0')}`
  return { start: `${prefix}-${String(Number(match[1])).padStart(2, '0')}`, end: `${prefix}-${String(Number(match[2])).padStart(2, '0')}` }
}

function pageCurrency(page: PdfTextPage): Currency | null {
  const heading = normalize(page.items.filter(item => item.y > 500).map(item => item.text).join(' '))
  if (heading.includes('resumen de cuenta en pesos')) return 'ARS'
  if (heading.includes('resumen de tenencias en dolares')) return 'USD'
  return null
}

function parsePageRows(page: PdfTextPage, inheritedCurrency: Currency | null): MercadoPagoRow[] {
  const currency = pageCurrency(page) ?? inheritedCurrency
  if (!currency) return []
  const meaningful = page.items.filter(item => item.text.trim())
  const descriptionHeader = meaningful.find(item => item.text === 'Descripción')
  const operationHeader = meaningful.find(item => item.text === 'ID de la')
  const valueHeader = meaningful.find(item => item.text === 'Valor')
  const balanceHeader = meaningful.find(item => item.text === 'Saldo')
  if (!descriptionHeader || !operationHeader || !valueHeader || !balanceHeader) return []

  const dateIndexes = meaningful.flatMap((item, index) => DATE_PATTERN.test(item.text.trim()) && item.x < descriptionHeader.x ? [index] : [])
  const rows: MercadoPagoRow[] = []
  for (let index = 0; index < dateIndexes.length; index += 1) {
    const startIndex = dateIndexes[index]
    const dateItem = meaningful[startIndex]
    const segment = meaningful.slice(startIndex, dateIndexes[index + 1] ?? meaningful.length)
    const description = segment
      .filter(item => item.x >= descriptionHeader.x - 2 && item.x < operationHeader.x - 4)
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map(item => item.text.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    const operation = segment.find(item => item.x >= operationHeader.x - 2 && item.x < valueHeader.x - 10 && OPERATION_PATTERN.test(item.text.trim()))
    const amount = segment.find(item => item.x >= valueHeader.x - 32 && item.x < balanceHeader.x - 18 && MONEY_PATTERN.test(item.text.trim()))
    if (!description || !operation || !amount) continue
    rows.push({
      date: toIsoDate(dateItem.text.trim()), description, externalId: operation.text.trim(),
      amountMinor: parseArgentineMoney(amount.text.trim()), currency,
    })
  }
  return rows
}

export function parseMercadoPagoStatement(pages: PdfTextPage[], now = new Date()): MercadoPagoStatement {
  if (!pages.length || !pages.some(page => page.items.some(item => normalize(item.text).includes('mercado pago')))) {
    throw new Error('El archivo no parece ser un resumen de Mercado Pago.')
  }
  const period = parsePeriod(pages)
  const today = now.toISOString().slice(0, 10)
  if (period.end >= today) throw new Error('Solo se pueden importar períodos cerrados. Elegí un resumen de un mes que ya terminó.')

  let currency: Currency | null = null
  const rows: MercadoPagoRow[] = []
  for (const page of pages) {
    currency = pageCurrency(page) ?? currency
    rows.push(...parsePageRows(page, currency))
  }
  if (!rows.length) throw new Error('No encontramos movimientos. El PDF puede estar escaneado o no tener una capa de texto compatible.')
  if (rows.some(row => row.date < period.start || row.date > period.end)) throw new Error('El resumen contiene movimientos fuera del período informado.')
  return { periodStart: period.start, periodEnd: period.end, rows }
}

const CATEGORY_RULES: Array<[string[], string]> = [
  [['sube', 'uber', 'cabify', 'emova'], 'Transporte'],
  [['disney', 'netflix', 'spotify', 'suscripcion'], 'Suscripciones'],
  [['cafe', 'restaurant', 'pan ', 'cinemark', 'comida'], 'Restaurantes y salidas'],
  [['supermercado', 'carrefour', 'coto', 'jumbo', 'dia%'], 'Supermercado'],
  [['mercado libre', 'compra'], 'Compras'],
  [['impuesto', 'afip', 'arba'], 'Impuestos'],
  [['farmacia', 'medic'], 'Salud'],
]

function suggestCategoryId(description: string, categories: Category[]): string {
  const normalized = normalize(description)
  const matchedName = CATEGORY_RULES.find(([terms]) => terms.some(term => normalized.includes(term)))?.[1] ?? 'Otros'
  return categories.find(category => category.kind === 'expense' && !category.archived && category.name === matchedName)?.id
    ?? categories.find(category => category.kind === 'expense' && !category.archived && category.name === 'Otros')?.id
    ?? categories.find(category => category.kind === 'expense' && !category.archived)?.id
    ?? ''
}

export function classifyMercadoPagoRows(rows: MercadoPagoRow[], categories: Category[]): ClassifiedMercadoPagoRow[] {
  return rows.map(row => {
    const description = normalize(row.description)
    let classification: ImportClassification = 'excluded'
    if (row.amountMinor < 0) {
      if (description.startsWith('transferencia enviada')) classification = 'ambiguous-transfer'
      else if (!description.startsWith('inversion') && !description.startsWith('liquidacion de dinero')) classification = 'expense'
    }
    return { ...row, classification, suggestedCategoryId: suggestCategoryId(row.description, categories) }
  })
}

export async function hashFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function findDuplicateExternalIds(rows: MercadoPagoRow[], database: GeezyDatabase = db): Promise<Set<string>> {
  const duplicates = new Set<string>()
  await Promise.all(rows.map(async row => {
    const found = await database.transactions.where('[source+currency+externalId]')
      .equals(['mercado-pago-pdf', row.currency, row.externalId]).first()
    if (found) duplicates.add(`${row.currency}:${row.externalId}`)
  }))
  return duplicates
}

export async function confirmMercadoPagoImport(input: ConfirmMercadoPagoImportInput, database: GeezyDatabase = db): Promise<ImportResult> {
  const existingBatch = await database.importBatches.where('fileHash').equals(input.fileHash).first()
  if (existingBatch) throw new Error('Este archivo ya fue importado anteriormente.')

  const duplicates = await findDuplicateExternalIds(input.selectedRows, database)
  const rows = input.selectedRows.filter(row => !duplicates.has(`${row.currency}:${row.externalId}`))
  const currencies = Array.from(new Set(rows.map(row => row.currency)))
  for (const currency of currencies) {
    const choice = input.accountsByCurrency[currency]
    if (!choice || (!choice.accountId && !choice.create)) throw new Error(`Elegí una cuenta para los gastos en ${currency}.`)
  }

  const now = new Date().toISOString()
  const officialRate = currencies.includes('USD') ? await latestOfficialRate(database) : undefined
  const batchId = crypto.randomUUID()
  const createdAccounts: Account[] = []
  const accountIds: Partial<Record<Currency, string>> = {}
  for (const currency of currencies) {
    const choice = input.accountsByCurrency[currency]!
    if (choice.create) {
      const account: Account = { id: crypto.randomUUID(), name: 'Mercado Pago', type: 'wallet', currency, initialBalanceMinor: 0, active: true, createdAt: now, updatedAt: now }
      createdAccounts.push(account)
      accountIds[currency] = account.id
    } else accountIds[currency] = choice.accountId
  }

  const transactions = rows.map<Transaction>(row => transactionSchema.parse({
    id: crypto.randomUUID(), date: row.date, amountMinor: Math.abs(row.amountMinor), currency: row.currency,
    type: 'expense', status: 'confirmed', accountId: accountIds[row.currency], categoryId: row.categoryId,
    description: row.description, notes: `Importado del resumen de Mercado Pago (${row.externalId}).`, tags: ['mercado-pago'],
    source: 'mercado-pago-pdf', externalId: row.externalId, importBatchId: batchId,
    ...(row.currency === 'USD' ? historicalRateFields(officialRate) : {}), createdAt: now, updatedAt: now,
  }) as Transaction)
  const batch = importBatchSchema.parse({
    id: batchId, source: 'mercado-pago-pdf', filename: input.filename, fileHash: input.fileHash,
    periodStart: input.periodStart, periodEnd: input.periodEnd, importedCount: transactions.length,
    excludedCount: input.excludedCount, duplicateCount: input.duplicateCount + duplicates.size, createdAt: now,
  }) as ImportBatch

  await database.transaction('rw', database.accounts, database.transactions, database.importBatches, async () => {
    if (createdAccounts.length) await database.accounts.bulkAdd(createdAccounts)
    if (transactions.length) await database.transactions.bulkAdd(transactions)
    await database.importBatches.add(batch)
  })
  return { batchId, importedCount: transactions.length, duplicateCount: batch.duplicateCount, createdAccounts }
}

