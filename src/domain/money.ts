import type { Currency, MinorAmount } from './types'

export function assertMinorAmount(value: number): asserts value is MinorAmount {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('El importe debe expresarse como un entero seguro en unidades mínimas')
  }
}

export function toMinorUnits(value: string | number): MinorAmount {
  const normalized = typeof value === 'number' ? String(value) : value.trim().replace(',', '.')
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new RangeError('El importe admite como máximo dos decimales')
  }
  const negative = normalized.startsWith('-')
  const [integer, decimals = ''] = normalized.replace('-', '').split('.')
  const result = Number(integer) * 100 + Number(decimals.padEnd(2, '0'))
  assertMinorAmount(result)
  return negative ? -result : result
}

export function formatMoney(amount: MinorAmount, currency: Currency, locale = 'es-AR'): string {
  assertMinorAmount(amount)
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, currencyDisplay: currency === 'USD' ? 'code' : 'narrowSymbol',
    maximumFractionDigits: currency === 'ARS' ? 0 : 2,
  }).format(amount / 100).replace(/^USD\s*/, 'USD ')
}

/** Conversión de referencia. La tasa se expresa como unidades destino por unidad origen. */
export function convertMinorUnits(amount: MinorAmount, rate: string | number): MinorAmount {
  assertMinorAmount(amount)
  const rateText = String(rate).replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(rateText) || Number(rateText) <= 0) {
    throw new RangeError('La cotización debe ser positiva')
  }
  const decimals = rateText.split('.')[1]?.length ?? 0
  const scale = 10 ** decimals
  const numerator = Number(rateText.replace('.', ''))
  const result = Math.round((amount * numerator) / scale)
  assertMinorAmount(result)
  return result
}
