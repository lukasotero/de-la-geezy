import type { Table } from 'dexie'
import { db, type GeezyDatabase } from './database'
import { createDefaultCategories } from './defaults'
import { accountSchema, categorySchema, transactionSchema } from '../models/schemas'
import type { Account, Category, Transaction } from '../models/entities'

export interface EntityRepository<T extends { id: string }> {
  list(): Promise<T[]>
  get(id: string): Promise<T | undefined>
  put(value: T): Promise<string>
  delete(id: string): Promise<void>
}

class DexieEntityRepository<T extends { id: string }> implements EntityRepository<T> {
  constructor(private readonly table: Table<T, string>, private readonly parse: (value: unknown) => T) {}
  list() { return this.table.toArray() }
  get(id: string) { return this.table.get(id) }
  put(value: T) { return this.table.put(this.parse(value)) }
  async delete(id: string) { await this.table.delete(id) }
}

export class FinanceRepository {
  readonly accounts: EntityRepository<Account>
  readonly categories: EntityRepository<Category>
  readonly transactions: EntityRepository<Transaction>

  constructor(readonly database: GeezyDatabase = db) {
    this.accounts = new DexieEntityRepository(database.accounts, value => accountSchema.parse(value) as Account)
    this.categories = new DexieEntityRepository(database.categories, value => categorySchema.parse(value) as Category)
    this.transactions = new DexieEntityRepository(database.transactions, value => transactionSchema.parse(value) as Transaction)
  }

  async initialize(): Promise<void> {
    if (await this.database.categories.count() === 0) await this.database.categories.bulkPut(createDefaultCategories())
    await this.database.appSettings.put({ key: 'schemaVersion', value: 3, updatedAt: new Date().toISOString() })
  }

  async saveTransfer(origin: Transaction, destination: Transaction): Promise<void> {
    if (origin.type !== 'transfer' || destination.type !== 'transfer' || origin.relatedId !== destination.id || destination.relatedId !== origin.id) {
      throw new Error('Los movimientos de una transferencia deben referenciarse entre sí.')
    }
    await this.database.transaction('rw', this.database.transactions, async () => {
      await this.database.transactions.bulkPut([
        transactionSchema.parse(origin) as Transaction,
        transactionSchema.parse(destination) as Transaction,
      ])
    })
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.database.transaction('rw', this.database.transactions, async () => {
      const transaction = await this.database.transactions.get(id)
      if (!transaction) return
      await this.database.transactions.delete(id)
      if (transaction.relatedId) await this.database.transactions.delete(transaction.relatedId)
    })
  }
}

export const repository = new FinanceRepository()
