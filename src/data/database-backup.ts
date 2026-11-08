import type { Table } from 'dexie'
import type { GeezyDatabase } from './database'

export const BACKUP_FORMAT = 'de-la-geezy-indexeddb'
export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_TABLE_NAMES = [
  'accounts', 'creditCards', 'categories', 'transactions', 'cardPurchases', 'installments', 'cardStatements',
  'cardPayments', 'recurringRules', 'recurringOccurrences', 'debts', 'debtPayments', 'exchangeRates', 'appSettings', 'importBatches',
] as const
export type BackupTableName = typeof BACKUP_TABLE_NAMES[number]

export type DatabaseBackup = {
  format: typeof BACKUP_FORMAT
  formatVersion: typeof BACKUP_FORMAT_VERSION
  exportedAt: string
  databaseVersion: number
  tables: Record<BackupTableName, unknown[]>
}

export type BackupSummary = {
  exportedAt: string
  tableCount: number
  recordCount: number
  accountCount: number
}

function tablesByName(database: GeezyDatabase) {
  return new Map(database.tables.map(table => [table.name, table]))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function primaryKeyPaths(table: Table): string[] {
  const keyPath = table.schema.primKey.keyPath
  if (Array.isArray(keyPath)) return keyPath
  return typeof keyPath === 'string' ? [keyPath] : []
}

export async function createDatabaseBackup(database: GeezyDatabase): Promise<DatabaseBackup> {
  await database.open()
  const entries = await Promise.all(database.tables.map(async table => [table.name, await table.toArray()] as const))
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    databaseVersion: database.verno,
    tables: Object.fromEntries(entries) as Record<BackupTableName, unknown[]>,
  }
}

export function parseDatabaseBackup(input: string): DatabaseBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new Error('El archivo no contiene un JSON válido.')
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) throw new Error('El archivo no es un respaldo de De La Geezy.')
  if (parsed.formatVersion !== BACKUP_FORMAT_VERSION) {
    if (typeof parsed.formatVersion === 'number' && parsed.formatVersion > BACKUP_FORMAT_VERSION) throw new Error('El respaldo fue creado por una versión más nueva de la aplicación.')
    throw new Error('La versión del respaldo no es compatible.')
  }
  if (typeof parsed.exportedAt !== 'string' || Number.isNaN(Date.parse(parsed.exportedAt))) throw new Error('El respaldo no tiene una fecha de exportación válida.')
  if (typeof parsed.databaseVersion !== 'number' || !Number.isFinite(parsed.databaseVersion)) throw new Error('El respaldo no indica una versión de base válida.')
  if (!isRecord(parsed.tables)) throw new Error('El respaldo no contiene tablas válidas.')
  return parsed as DatabaseBackup
}

export function validateDatabaseBackup(database: GeezyDatabase, backup: DatabaseBackup): BackupSummary {
  if (backup.databaseVersion > database.verno) throw new Error('El respaldo usa una base de datos más nueva que esta aplicación.')
  const currentTables = tablesByName(database)
  const backupNames = Object.keys(backup.tables)
  const backupNameSet = new Set(backupNames)
  const missing = [...currentTables.keys()].filter(name => !backupNameSet.has(name))
  if (missing.length) throw new Error(`El respaldo está incompleto. Faltan: ${missing.join(', ')}.`)
  const unknown = backupNames.filter(name => !currentTables.has(name))
  if (unknown.length) throw new Error(`El respaldo contiene tablas desconocidas: ${unknown.join(', ')}.`)

  let recordCount = 0
  for (const [name, table] of currentTables) {
    const rows = backup.tables[name as BackupTableName]
    if (!Array.isArray(rows)) throw new Error(`La tabla ${name} no contiene una lista válida.`)
    const keyPaths = primaryKeyPaths(table)
    for (const row of rows) {
      if (!isRecord(row)) throw new Error(`La tabla ${name} contiene un registro inválido.`)
      if (keyPaths.some(path => row[path] === undefined || row[path] === null || row[path] === '')) throw new Error(`La tabla ${name} contiene un registro sin clave primaria.`)
    }
    recordCount += rows.length
  }
  return {
    exportedAt: backup.exportedAt,
    tableCount: currentTables.size,
    recordCount,
    accountCount: backup.tables.accounts.length,
  }
}

export async function restoreDatabaseBackup(database: GeezyDatabase, backup: DatabaseBackup): Promise<BackupSummary> {
  await database.open()
  const summary = validateDatabaseBackup(database, backup)
  const tables = database.tables
  await database.transaction('rw', tables, async () => {
    await Promise.all(tables.map(table => table.clear()))
    await Promise.all(tables.map(async table => {
      const rows = backup.tables[table.name as BackupTableName]
      if (rows.length) await table.bulkAdd(rows)
    }))
  })
  return summary
}

export function backupFilename(date = new Date()): string {
  const localDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  return `de-la-geezy-respaldo-${localDate}.json`
}
