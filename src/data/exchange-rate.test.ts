import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeezyDatabase } from './database'
import { ExchangeRateService, parseOfficialDollarRate } from './exchange-rate'

const databases: GeezyDatabase[] = []
const payload = { venta: 1450, fechaActualizacion: '2026-11-04T11:55:00.000Z' }

function setup(fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(payload), { status: 200 }))) {
  const database = new GeezyDatabase(`exchange-rate-${crypto.randomUUID()}`)
  databases.push(database)
  return { database, fetcher, service: new ExchangeRateService(database, fetcher) }
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(databases.splice(0).map(async database => { database.close(); await database.delete() }))
})

describe('validación de DolarApi', () => {
  it('acepta venta y fecha válidas sin depender del valor de compra', () => {
    expect(parseOfficialDollarRate(payload)).toEqual(payload)
    expect(parseOfficialDollarRate({ ...payload, compra: 'dato ignorado' })).toEqual(payload)
  })

  it.each([
    null, {},
    { ...payload, venta: 0 }, { ...payload, venta: Number.POSITIVE_INFINITY }, { ...payload, fechaActualizacion: 'sin-fecha' },
  ])('rechaza una respuesta inválida: %o', value => {
    expect(parseOfficialDollarRate(value)).toBeNull()
  })
})

describe('cotización oficial automática', () => {
  it('invoca el fetch global con el contexto del entorno', async () => {
    const globalFetcher = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))
    })
    vi.stubGlobal('fetch', globalFetcher)
    const database = new GeezyDatabase(`exchange-rate-${crypto.randomUUID()}`)
    databases.push(database)

    await expect(new ExchangeRateService(database).getOfficial({ force: true })).resolves.toMatchObject({ fresh: true })
    expect(globalFetcher).toHaveBeenCalledOnce()
  })

  it('persiste una respuesta válida con la fecha de la fuente', async () => {
    const { database, fetcher, service } = setup()
    const result = await service.getOfficial()
    expect(result).toMatchObject({ fresh: true, rate: { source: 'dolarapi', rateType: 'official', buy: 1450, sell: 1450, sourceUpdatedAt: payload.fechaActualizacion } })
    expect(fetcher).toHaveBeenCalledOnce()
    await expect(database.exchangeRates.count()).resolves.toBe(1)
  })

  it('reutiliza durante seis horas la última oficial e ignora una manual más nueva', async () => {
    const { database, fetcher, service } = setup()
    const fetchedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const current = new Date().toISOString()
    await database.exchangeRates.bulkAdd([
      { id: 'official', source: 'dolarapi', rateType: 'official', buy: 1300, sell: 1350, fetchedAt, createdAt: fetchedAt, updatedAt: fetchedAt },
      { id: 'manual', source: 'manual', rateType: 'custom', buy: 1, sell: 1, fetchedAt: current, createdAt: fetchedAt, updatedAt: fetchedAt },
    ])
    await expect(service.getOfficial()).resolves.toMatchObject({ fresh: false, rate: { id: 'official' } })
    expect(fetcher).not.toHaveBeenCalled()
    await expect(service.latestOfficial()).resolves.toMatchObject({ id: 'official' })
  })

  it('actualiza una cotización vencida y force omite una caché vigente', async () => {
    const { database, fetcher, service } = setup()
    const expiredAt = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()
    await database.exchangeRates.add({ id: 'expired', source: 'dolarapi', rateType: 'official', buy: 1200, sell: 1250, fetchedAt: expiredAt, createdAt: expiredAt, updatedAt: expiredAt })
    await expect(service.getOfficial()).resolves.toMatchObject({ fresh: true })
    await expect(service.getOfficial({ force: true })).resolves.toMatchObject({ fresh: true })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('usa la última oficial con advertencia cuando falla la red', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('sin conexión'))
    const { database, service } = setup(fetcher)
    const fetchedAt = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()
    await database.exchangeRates.add({ id: 'fallback', source: 'dolarapi', rateType: 'official', buy: 1200, sell: 1250, fetchedAt, createdAt: fetchedAt, updatedAt: fetchedAt })
    await expect(service.getOfficial()).resolves.toMatchObject({ fresh: false, rate: { id: 'fallback' }, warning: expect.stringMatching(/última disponible/i) })
  })

  it('informa el error si nunca hubo una cotización oficial', async () => {
    const { service } = setup(vi.fn<typeof fetch>().mockRejectedValue(new Error('sin conexión')))
    await expect(service.getOfficial()).rejects.toThrow('sin conexión')
  })
})
