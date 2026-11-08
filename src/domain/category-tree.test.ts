import { describe, expect, it } from 'vitest'
import type { Category } from '@/models'
import { flattenCategoryTree, getCategoryDescendantIds } from './category-tree'

const category = (id: string, name: string, order: number, parentId?: string, archived = false): Category => ({
  id, name, order, parentId, archived, kind: 'expense', icon: 'Shapes', color: '#fff', createdAt: '', updatedAt: '',
})

describe('getCategoryDescendantIds', () => {
  it('encuentra todos los descendientes sin incluir ramas ajenas', () => {
    const categories = [category('root', 'Raíz', 0), category('child', 'Hija', 0, 'root'), category('grandchild', 'Nieta', 0, 'child'), category('other', 'Otra', 0)]

    expect(getCategoryDescendantIds(categories, 'root')).toEqual(new Set(['child', 'grandchild']))
    expect(getCategoryDescendantIds(categories, 'child')).toEqual(new Set(['grandchild']))
    expect(getCategoryDescendantIds(categories, 'other')).toEqual(new Set())
  })

  it('termina de forma segura si los datos contienen un ciclo', () => {
    const categories = [category('a', 'A', 0, 'b'), category('b', 'B', 0, 'a')]
    expect(getCategoryDescendantIds(categories, 'a')).toEqual(new Set(['b']))
  })
})

describe('flattenCategoryTree', () => {
  it('agrupa descendientes recursivamente y ordena alfabéticamente cada nivel', () => {
    const result = flattenCategoryTree([
      category('child-2', 'Segundo hijo', 2, 'root'),
      category('grandchild', 'Nieto', 0, 'child-1'),
      category('other', 'Otra raíz', 2),
      category('root', 'Raíz', 1),
      category('child-1', 'Primer hijo', 1, 'root'),
    ])

    expect(result.map(item => [item.category.id, item.depth])).toEqual([
      ['other', 0], ['root', 0], ['child-1', 1], ['grandchild', 2], ['child-2', 1],
    ])
  })

  it('conserva archivadas y muestra huérfanas como raíces', () => {
    const result = flattenCategoryTree([
      category('archived', 'Archivada', 1, undefined, true),
      category('orphan', 'Huérfana', 0, 'missing'),
    ])

    expect(result.map(item => [item.category.id, item.depth, item.category.archived])).toEqual([
      ['archived', 0, true], ['orphan', 0, false],
    ])
  })

  it('no duplica ni entra en recursión ante ciclos existentes', () => {
    const result = flattenCategoryTree([
      category('a', 'A', 0, 'b'),
      category('b', 'B', 0, 'a'),
    ])

    expect(result).toHaveLength(2)
    expect(new Set(result.map(item => item.category.id))).toEqual(new Set(['a', 'b']))
  })
})
