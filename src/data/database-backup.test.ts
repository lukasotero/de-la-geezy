import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { GeezyDatabase } from './database'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, createDatabaseBackup, parseDatabaseBackup, restoreDatabaseBackup, validateDatabaseBackup, type BackupTableName } from './database-backup'

const names: string[] = []
const stamp = '2026-11-06T12:00:00.000Z'

function database() {
  const name = `backup-test-${crypto.randomUUID()}`
  names.push(name)
  return new GeezyDatabase(name)
}

afterEach(async () => { await Promise.all(names.splice(0).map(name => Dexie.delete(name))) })

describe('respaldo de IndexedDB', () => {
  it('exporta todas las tablas y conserva los registros', async () => {
    const db = database()
    await db.accounts.add({ id: 'account-1', name: 'Banco', type: 'bank', currency: 'ARS', initialBalanceMinor: 1200, active: true, createdAt: stamp, updatedAt: stamp })
    await db.categories.add({ id: 'category-1', name: 'Comida', kind: 'expense', icon: 'Shapes', color: '#ffffff', order: 0, archived: false, createdAt: stamp, updatedAt: stamp })

    const backup = await createDatabaseBackup(db)

    expect(Object.keys(backup.tables).sort()).toEqual(db.tables.map(table => table.name).sort())
    expect(backup.tables.accounts).toHaveLength(1)
    expect(backup.tables.categories).toHaveLength(1)
  })

  it('reemplaza la base por una copia exacta', async () => {
    const source = database()
    await source.accounts.add({ id: 'source', name: 'Origen', type: 'bank', currency: 'ARS', initialBalanceMinor: 500, active: true, createdAt: stamp, updatedAt: stamp })
    const backup = await createDatabaseBackup(source)
    const target = database()
    await target.accounts.add({ id: 'old', name: 'Anterior', type: 'cash', currency: 'USD', initialBalanceMinor: 10, active: true, createdAt: stamp, updatedAt: stamp })

    await restoreDatabaseBackup(target, backup)

    expect(await target.accounts.toArray()).toEqual(await source.accounts.toArray())
    for (const table of target.tables) expect(await table.toArray()).toEqual(backup.tables[table.name as BackupTableName])
  })

  it('revierte toda la restauración si un índice único falla', async () => {
    const db = database()
    await db.accounts.add({ id: 'safe', name: 'Conservar', type: 'bank', currency: 'ARS', initialBalanceMinor: 0, active: true, createdAt: stamp, updatedAt: stamp })
    const backup = await createDatabaseBackup(db)
    backup.tables.accounts = []
    backup.tables.importBatches = [
      { id: 'one', source: 'mercado-pago-pdf', filename: 'a.pdf', fileHash: 'a'.repeat(64), periodStart: '2026-01-01', periodEnd: '2026-01-31', importedCount: 1, excludedCount: 0, duplicateCount: 0, createdAt: stamp },
      { id: 'two', source: 'mercado-pago-pdf', filename: 'b.pdf', fileHash: 'a'.repeat(64), periodStart: '2026-01-01', periodEnd: '2026-01-31', importedCount: 1, excludedCount: 0, duplicateCount: 0, createdAt: stamp },
    ]

    await expect(restoreDatabaseBackup(db, backup)).rejects.toThrow()
    expect(await db.accounts.get('safe')).toMatchObject({ name: 'Conservar' })
    expect(await db.importBatches.count()).toBe(0)
  })

  it('rechaza archivos inválidos, incompletos y de versiones futuras', async () => {
    const db = database()
    await expect(() => parseDatabaseBackup('{')).toThrow('JSON válido')
    await expect(() => parseDatabaseBackup('{}')).toThrow('no es un respaldo')
    await expect(() => parseDatabaseBackup(JSON.stringify({ format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION + 1 }))).toThrow('versión más nueva')
    const backup = await createDatabaseBackup(db)
    delete (backup.tables as Partial<typeof backup.tables>).accounts
    expect(() => validateDatabaseBackup(db, backup)).toThrow('incompleto')
  })

  it('acepta tablas vacías y configuraciones serializables', async () => {
    const db = database()
    await db.appSettings.put({ key: 'preferences', value: { compact: true, labels: ['uno'] }, updatedAt: stamp })
    const backup = parseDatabaseBackup(JSON.stringify(await createDatabaseBackup(db)))
    const target = database()

    const summary = await restoreDatabaseBackup(target, backup)

    expect(summary.accountCount).toBe(0)
    expect(await target.appSettings.get('preferences')).toMatchObject({ value: { compact: true, labels: ['uno'] } })
  })
})
