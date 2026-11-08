import type { ExchangeRate, Transaction } from '../models/entities'
import { db, type GeezyDatabase } from './database'

export type DolarApiResponse = {
  venta: number
  fechaActualizacion: string
}

export type ExchangeRateResult = {
  rate: ExchangeRate
  fresh: boolean
  warning?: string
}

const SIX_HOURS = 6 * 60 * 60 * 1000
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `rate-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function parseOfficialDollarRate(value: unknown): DolarApiResponse | null {
  if (!value || typeof value !== 'object') return null
  const { venta, fechaActualizacion } = value as Partial<DolarApiResponse>
  if (typeof venta !== 'number' || !Number.isFinite(venta) || venta <= 0) return null
  if (typeof fechaActualizacion !== 'string' || !Number.isFinite(Date.parse(fechaActualizacion))) return null
  return { venta, fechaActualizacion }
}

export async function latestOfficialRate(database: GeezyDatabase = db): Promise<ExchangeRate | undefined> {
  const rates = await database.exchangeRates.where('source').equals('dolarapi').toArray()
  return rates.reduce<ExchangeRate | undefined>((latest, rate) => !latest || rate.fetchedAt > latest.fetchedAt ? rate : latest, undefined)
}

export function historicalRateFields(rate?: ExchangeRate): Pick<Transaction, 'exchangeRateId' | 'effectiveRate'> {
  return rate ? { exchangeRateId: rate.id, effectiveRate: rate.sell } : {}
}

export class ExchangeRateService {
  constructor(
    private readonly database: GeezyDatabase = db,
    private readonly fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
    private readonly endpoint = 'https://dolarapi.com/v1/dolares/oficial',
  ) {}

  async latestOfficial(): Promise<ExchangeRate | undefined> {
    return latestOfficialRate(this.database)
  }

  async getOfficial(options: { force?: boolean } = {}): Promise<ExchangeRateResult> {
    const cached = await this.latestOfficial()
    if (!options.force && cached && Date.now() - new Date(cached.fetchedAt).getTime() < SIX_HOURS) {
      return { rate: cached, fresh: false }
    }

    try {
      const response = await this.fetcher(this.endpoint, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`La API respondió ${response.status}.`)
      const payload = parseOfficialDollarRate(await response.json())
      if (!payload) throw new Error('La cotización recibida no es válida.')
      const now = new Date().toISOString()
      const rate: ExchangeRate = {
        // `buy` remains populated for backwards-compatible historical records; all current calculations use `sell`.
        id: makeId(), source: 'dolarapi', rateType: 'official', buy: payload.venta, sell: payload.venta,
        fetchedAt: now, sourceUpdatedAt: payload.fechaActualizacion, createdAt: now, updatedAt: now,
      }
      await this.database.exchangeRates.put(rate)
      return { rate, fresh: true }
    } catch (error) {
      if (cached) return { rate: cached, fresh: false, warning: 'No pudimos actualizar la cotización. Mostramos la última disponible.' }
      throw new Error(error instanceof Error ? error.message : 'No se pudo consultar la cotización.')
    }
  }

}

export function convertCurrency(amountMinor: number, from: 'ARS' | 'USD', to: 'ARS' | 'USD', rate: ExchangeRate): number {
  if (from === to) return amountMinor
  return from === 'USD' ? Math.round(amountMinor * rate.sell) : Math.round(amountMinor / rate.sell)
}

export const exchangeRateService = new ExchangeRateService()
