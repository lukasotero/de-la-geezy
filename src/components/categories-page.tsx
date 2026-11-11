import { useMemo, useRef, useState } from 'react'
import { Archive, ArchiveRestore, ChevronDown, FolderTree, LoaderCircle, Pencil, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/data'
import { flattenCategoryTree, getCategoryDescendantIds } from '@/domain/category-tree'
import type { Category } from '@/models'
import { FormSelect } from './form-controls'
import { IconAction } from './icon-action'
import { ConfirmationDialog } from './confirmation-dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

type Props = { categories: Category[]; onRefresh: () => Promise<void> }

type CategoryRowProps = {
  category: Category
  depth: number
  archived?: boolean
  selected: boolean
  restoring: boolean
  onSelect: () => void
  onToggleArchived: () => Promise<boolean>
}

const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
type RunCategoryAction = (action: () => Promise<unknown>, success: string, key: string) => Promise<boolean>

async function persistCategory(form: HTMLFormElement, categories: Category[], selectedCategory: Category | undefined, descendants: Set<string>, run: RunCategoryAction) {
  const data = new FormData(form)
  if (!selectedCategory) {
    const kind = value(data, 'category-kind') as Category['kind']
    const parentId = value(data, 'category-parent') || undefined
    const parent = parentId ? categories.find(item => item.id === parentId) : undefined
    if (parent && parent.kind !== kind) {
      toast.error('La categoría padre debe ser del mismo tipo.')
      return
    }
    const saved = await run(async () => {
      const stamp = new Date().toISOString()
      await db.categories.add({ id: crypto.randomUUID(), name: value(data, 'category-name'), kind, parentId, icon: 'Shapes', color: '#AAB3B1', order: categories.length, archived: false, createdAt: stamp, updatedAt: stamp })
    }, 'Categoría guardada.', 'category:create')
    if (saved) form.reset()
    return
  }

  const parentId = selectedCategory.archived ? selectedCategory.parentId : value(data, 'category-parent') || undefined
  const parent = parentId ? categories.find(item => item.id === parentId) : undefined
  if (parentId === selectedCategory.id || descendants.has(parentId ?? '') || (parent && parent.kind !== selectedCategory.kind)) {
    toast.error('Elegí una categoría padre válida.')
    return
  }
  const moved = parentId !== selectedCategory.parentId
  await run(
    () => db.categories.put({ ...selectedCategory, name: value(data, 'category-name'), parentId, updatedAt: new Date().toISOString() }),
    moved ? 'Categoría actualizada y reubicada.' : 'Categoría actualizada.',
    `category:save:${selectedCategory.id}`,
  )
}

function CategoryRow({ category, depth, archived = false, selected, restoring, onSelect, onToggleArchived }: CategoryRowProps) {
  const archiveAction = category.archived
    ? <IconAction size="icon-sm" variant="ghost" icon={ArchiveRestore} loading={restoring} label={`Restaurar categoría ${category.name}`} onClick={() => void onToggleArchived()} />
    : <ConfirmationDialog trigger={<IconAction size="icon-sm" variant="ghost" icon={Archive} label={`Archivar categoría ${category.name}`} />} title="¿Archivar esta categoría?" description={<>La categoría <strong>{category.name}</strong> dejará de estar disponible para nuevos movimientos. El historial no se modifica.</>} confirmLabel="Archivar" pendingLabel="Archivando…" onConfirm={onToggleArchived} />

  return <div className="relative" style={{ marginLeft: archived ? 0 : `${depth * 18}px` }} data-testid="category-row" data-depth={depth} data-archived={category.archived || undefined}>
    {!archived && depth > 0 ? <span className="absolute -left-3 top-0 h-1/2 w-3 rounded-bl-lg border-b border-l border-line" aria-hidden="true" /> : null}
    <div className={`group grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b px-2 py-1.5 transition-colors ${selected ? 'border-primary/25 bg-primary/[0.08]' : 'border-line hover:bg-raised/45'} ${depth === 0 && !archived ? 'mt-1' : ''}`}>
      <button type="button" className="min-w-0 rounded-lg px-1.5 py-1 text-left focus-visible:ring-2 focus-visible:ring-primary/50" aria-pressed={selected} onClick={onSelect}>
        <span className="flex min-w-0 items-center gap-2"><span className={`size-1.5 shrink-0 rounded-full ${category.kind === 'income' ? 'bg-success' : 'bg-accent'}`} aria-hidden="true" /><span className="truncate text-sm font-medium text-text">{category.name}</span>{archived ? <span className="shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[10px] text-muted">Archivada</span> : null}</span>
        <span className="ml-3.5 block text-[11px] text-muted">{category.kind === 'income' ? 'Ingreso' : 'Gasto'}{depth > 0 && !archived ? ` · Nivel ${depth + 1}` : ''}</span>
      </button>
      <div className="flex gap-1"><IconAction size="icon-sm" variant="ghost" icon={Pencil} label={`Editar categoría ${category.name}`} onClick={onSelect} />{archiveAction}</div>
    </div>
  </div>
}

function CategoryEditorArchiveAction({ category, pending, onToggleArchived }: { category: Category; pending: boolean; onToggleArchived: () => Promise<boolean> }) {
  if (category.archived) {
    return <Button type="button" variant="outline" disabled={pending} onClick={() => void onToggleArchived()}><ArchiveRestore aria-hidden="true" />Restaurar categoría</Button>
  }

  return <ConfirmationDialog trigger={<Button type="button" variant="outline"><Archive aria-hidden="true" />Archivar categoría</Button>} title="¿Archivar esta categoría?" description={<>La categoría <strong>{category.name}</strong> dejará de estar disponible para nuevos movimientos. El historial no se modifica.</>} confirmLabel="Archivar" pendingLabel="Archivando…" onConfirm={onToggleArchived} />
}

type CategoriesViewProps = {
  activeCount: number
  activeTree: ReturnType<typeof flattenCategoryTree>
  archivedCategories: Category[]
  selectedCategory?: Category
  parentOptions: { value: string; label: string }[]
  formKey: string
  saving: boolean
  pending: Set<string>
  renderCategory: (category: Category, depth: number, archived?: boolean) => React.ReactNode
  onNew: () => void
  onSave: (form: HTMLFormElement) => Promise<void>
  onToggleArchived: (category: Category) => Promise<boolean>
}

function CategoryTreePanel({ activeCount, activeTree, archivedCategories, renderCategory, onNew }: Pick<CategoriesViewProps, 'activeCount' | 'activeTree' | 'archivedCategories' | 'renderCategory' | 'onNew'>) {
  return <section className="min-w-0 overflow-hidden rounded-[18px] border border-line bg-surface/55" aria-labelledby="category-tree-title">
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5"><div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-accent"><FolderTree size={16} aria-hidden="true" /></div><div className="min-w-0"><h2 id="category-tree-title" className="text-base">Árbol de categorías</h2><p className="mb-0 text-xs text-muted">{activeCount} activas</p></div></div>
      <Button type="button" size="sm" variant="outline" onClick={onNew}><Plus aria-hidden="true" />Nueva</Button>
    </div>
    <div className="p-2" aria-label="Árbol de categorías activas">{activeTree.length ? activeTree.map(({ category, depth }) => renderCategory(category, depth)) : <div className="px-3 py-8 text-center text-sm text-muted">Todavía no hay categorías. Creá la primera para empezar.</div>}</div>
    {archivedCategories.length ? <details className="group border-t border-line px-2 pb-2"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-2 text-sm font-medium text-muted hover:bg-raised hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><span>Categorías archivadas</span><span className="flex items-center gap-2"><span className="rounded-full bg-raised px-2 py-0.5 text-xs tabular-nums">{archivedCategories.length}</span><ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" /></span></summary><div aria-label="Categorías archivadas">{archivedCategories.map(category => renderCategory(category, 0, true))}</div></details> : null}
  </section>
}

function CategoriesView({ activeCount, activeTree, archivedCategories, selectedCategory, parentOptions, formKey, saving, pending, renderCategory, onNew, onSave, onToggleArchived }: CategoriesViewProps) {
  return <div>
    <div className="mb-6"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">ORGANIZACIÓN</div><h1 className="mb-[10px] text-[clamp(30px,7vw,52px)] leading-none tracking-[-0.05em]">Categorías</h1><p className="text-sm text-muted">Creá jerarquías y archivá sin borrar el historial.</p></div>
    <div className="grid items-start gap-4 desktop:grid-cols-[minmax(0,1fr)_340px]">
      <CategoryTreePanel activeCount={activeCount} activeTree={activeTree} archivedCategories={archivedCategories} renderCategory={renderCategory} onNew={onNew} />

      <aside className="rounded-[18px] border border-line bg-[rgba(32,38,41,0.86)] p-4 desktop:sticky desktop:top-4" aria-labelledby="category-editor-title">
        <div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="category-editor-title" className="text-base">{selectedCategory ? 'Editar categoría' : 'Nueva categoría'}</h2><p className="mb-0 mt-1 text-xs text-muted">{selectedCategory ? (selectedCategory.archived ? 'Podés renombrarla o restaurarla.' : 'Cambiá el nombre o su ubicación en el árbol.') : 'Sumala como raíz o dentro de otra categoría.'}</p></div>{selectedCategory ? <Button type="button" size="icon-sm" variant="ghost" aria-label="Crear nueva categoría" onClick={onNew}><Plus aria-hidden="true" /></Button> : null}</div>
        <form key={formKey} className="grid gap-3" onSubmit={event => { event.preventDefault(); void onSave(event.currentTarget) }}>
          <div className="grid gap-1"><Label htmlFor="category-name">Nombre</Label><Input id="category-name" name="category-name" defaultValue={selectedCategory?.name} required /></div>
          {selectedCategory ? <div className="grid gap-1"><span className="text-sm font-medium">Tipo</span><div className="flex min-h-11 items-center rounded-[13px] border border-line bg-bg/35 px-3 text-sm text-muted">{selectedCategory.kind === 'income' ? 'Ingreso' : 'Gasto'}</div></div> : <FormSelect className="gap-1" label="Tipo" name="category-kind" defaultValue="expense" required options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]} />}
          {!selectedCategory?.archived ? <FormSelect className="gap-1" label="Categoría padre (opcional)" name="category-parent" defaultValue={selectedCategory?.parentId ?? ''} options={[{ value: '', label: 'Sin padre' }, ...parentOptions]} /> : null}
          <Button type="submit" disabled={saving} aria-busy={saving}>{saving ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Guardando…</> : <><Save aria-hidden="true" />{selectedCategory ? 'Guardar cambios' : 'Guardar categoría'}</>}</Button>
          {selectedCategory ? <CategoryEditorArchiveAction category={selectedCategory} pending={pending.has(`category:archive:${selectedCategory.id}`)} onToggleArchived={() => onToggleArchived(selectedCategory)} /> : null}
        </form>
      </aside>
    </div>
  </div>
}

export function CategoriesPage({ categories, onRefresh }: Props) {
  const [pending, setPending] = useState<Set<string>>(() => new Set())
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>()
  const pendingRef = useRef(new Set<string>())
  const activeCategories = useMemo(() => categories.filter(category => !category.archived), [categories])
  const activeCategoryTree = useMemo(() => flattenCategoryTree(activeCategories), [activeCategories])
  const archivedCategories = useMemo(() => categories.filter(category => category.archived).sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })), [categories])
  const selectedCategory = categories.find(category => category.id === selectedCategoryId)
  const descendants = useMemo(() => selectedCategory ? getCategoryDescendantIds(categories, selectedCategory.id) : new Set<string>(), [categories, selectedCategory])
  const parentOptions = useMemo(() => {
    const kind = selectedCategory?.kind
    return activeCategoryTree
      .filter(({ category }) => (!kind || category.kind === kind) && category.id !== selectedCategory?.id && !descendants.has(category.id))
      .map(({ category, depth }) => ({ value: category.id, label: `${'— '.repeat(depth)}${category.name}` }))
  }, [activeCategoryTree, descendants, selectedCategory])

  const run = async (action: () => Promise<unknown>, success: string, key: string) => {
    if (pendingRef.current.has(key)) return false
    pendingRef.current.add(key)
    setPending(current => new Set(current).add(key))
    try {
      await action()
      await onRefresh()
      toast.success(success)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos completar la operación.')
      return false
    } finally {
      pendingRef.current.delete(key)
      setPending(current => { const next = new Set(current); next.delete(key); return next })
    }
  }

  const saveCategory = async (form: HTMLFormElement) => {
    await persistCategory(form, categories, selectedCategory, descendants, run)
  }

  const toggleArchived = async (category: Category) => {
    const restored = category.archived
    const saved = await run(
      () => db.categories.put({ ...category, archived: !category.archived, updatedAt: new Date().toISOString() }),
      restored ? 'Categoría restaurada.' : 'Categoría archivada.',
      `category:archive:${category.id}`,
    )
    if (saved && selectedCategoryId === category.id) setSelectedCategoryId(undefined)
    return saved
  }

  const renderCategory = (category: Category, depth: number, archived = false) => {
    const archiveKey = `category:archive:${category.id}`
    return <CategoryRow key={category.id} category={category} depth={depth} archived={archived} selected={selectedCategoryId === category.id} restoring={pending.has(archiveKey)} onSelect={() => setSelectedCategoryId(category.id)} onToggleArchived={() => toggleArchived(category)} />
  }

  const formKey = selectedCategory ? `edit-${selectedCategory.id}-${selectedCategory.updatedAt}` : 'create'
  const saving = pending.has(selectedCategory ? `category:save:${selectedCategory.id}` : 'category:create')

  return <CategoriesView activeCount={activeCategories.length} activeTree={activeCategoryTree} archivedCategories={archivedCategories} selectedCategory={selectedCategory} parentOptions={parentOptions} formKey={formKey} saving={saving} pending={pending} renderCategory={renderCategory} onNew={() => setSelectedCategoryId(undefined)} onSave={saveCategory} onToggleArchived={toggleArchived} />
}
