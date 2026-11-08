import type { Category } from '../models/entities'

const expenseCategories = [
  ['Supermercado', 'ShoppingBasket', '#C5F277'], ['Vivienda', 'House', '#E5B769'], ['Servicios', 'ReceiptText', '#85C7F2'],
  ['Transporte', 'Bus', '#BAA3F5'], ['Salud', 'HeartPulse', '#F08A8A'], ['Educación', 'GraduationCap', '#67D5B5'],
  ['Restaurantes y salidas', 'Utensils', '#F3A56B'], ['Compras', 'ShoppingBag', '#E08FC7'], ['Suscripciones', 'Repeat2', '#829BD9'],
  ['Viajes', 'Plane', '#6ED0D0'], ['Mascotas', 'PawPrint', '#D5A66F'], ['Impuestos', 'Landmark', '#AAB3B1'], ['Otros', 'Shapes', '#8D9997'],
] as const

const incomeCategories = [
  ['Sueldo', 'BriefcaseBusiness', '#C5F277'], ['Honorarios', 'Laptop', '#85C7F2'], ['Ventas', 'BadgeDollarSign', '#67D5B5'],
  ['Intereses', 'TrendingUp', '#BAA3F5'], ['Otros ingresos', 'CircleDollarSign', '#AAB3B1'],
] as const

export function createDefaultCategories(now = new Date().toISOString()): Category[] {
  return [...expenseCategories.map((item, index) => ({ item, index, kind: 'expense' as const })),
    ...incomeCategories.map((item, index) => ({ item, index, kind: 'income' as const }))]
    .map(({ item: [name, icon, color], index, kind }) => ({
      id: `category:${kind}:${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')}`,
      name, kind, icon, color, order: index, archived: false, system: true, createdAt: now, updatedAt: now,
    }))
}
