export function normalizeArgentineAmount(value: string) {
  const clean = value.replace(/[^\d,]/g, '')
  const [integer = '', ...decimalParts] = clean.split(',')
  const decimals = decimalParts.join('').slice(0, 2)
  const normalizedInteger = integer.replace(/^0+(?=\d)/, '')
  return `${normalizedInteger || (clean ? '0' : '')}${clean.includes(',') ? `.${decimals}` : ''}`
}

export function formatArgentineAmount(value: string) {
  const clean = value.replace(/[^\d,]/g, '')
  const [integer = '', ...decimalParts] = clean.split(',')
  const grouped = (integer.replace(/^0+(?=\d)/, '') || (clean ? '0' : '')).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${grouped}${clean.includes(',') ? `,${decimalParts.join('').slice(0, 2)}` : ''}`
}

export function displayArgentineAmount(value: string) {
  return formatArgentineAmount(value.replace('.', ','))
}
