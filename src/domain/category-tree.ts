import type { Category } from '@/models'

export type CategoryTreeItem = { category: Category; depth: number }

const compareCategories = (left: Category, right: Category) =>
  left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })

export function flattenCategoryTree(categories: Category[]): CategoryTreeItem[] {
  const ids = new Set(categories.map(category => category.id))
  const children = new Map<string, Category[]>()
  const roots: Category[] = []

  for (const category of categories) {
    if (!category.parentId || !ids.has(category.parentId)) roots.push(category)
    else children.set(category.parentId, [...(children.get(category.parentId) ?? []), category])
  }

  roots.sort(compareCategories)
  for (const group of children.values()) group.sort(compareCategories)

  const result: CategoryTreeItem[] = []
  const visited = new Set<string>()
  const visit = (category: Category, depth: number) => {
    if (visited.has(category.id)) return
    visited.add(category.id)
    result.push({ category, depth })
    for (const child of children.get(category.id) ?? []) visit(child, depth + 1)
  }

  for (const root of roots) visit(root, 0)
  for (const category of [...categories].sort(compareCategories)) visit(category, 0)
  return result
}

export function getCategoryDescendantIds(categories: Category[], categoryId: string): Set<string> {
  const children = new Map<string, string[]>()
  for (const category of categories) {
    if (!category.parentId) continue
    children.set(category.parentId, [...(children.get(category.parentId) ?? []), category.id])
  }

  const descendants = new Set<string>()
  const pending = [...(children.get(categoryId) ?? [])]
  while (pending.length) {
    const childId = pending.pop()
    if (!childId || descendants.has(childId) || childId === categoryId) continue
    descendants.add(childId)
    pending.push(...(children.get(childId) ?? []))
  }
  return descendants
}
