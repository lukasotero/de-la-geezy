import { useId, useState, type KeyboardEvent, type Ref } from 'react'
import { Check, ChevronDown, CornerDownRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type SearchableOption = {
  value: string
  label: string
  depth?: number
  parentPath?: string
  disabled?: boolean
}

type Props = {
  id?: string
  ariaLabel?: string
  value?: string
  options: SearchableOption[]
  onValueChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  className?: string
  ref?: Ref<HTMLButtonElement>
}

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

export function CategorySelect({ id, ariaLabel, value, options, onValueChange, onBlur, placeholder = 'Elegí una opción', disabled, required, invalid, className, ref }: Props) {
  const listId = useId()
  const popupId = `${listId}-popup`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeValue, setActiveValue] = useState<string>()
  const terms = fold(query).trim().split(/\s+/).filter(Boolean)
  const visible = terms.length ? options.filter(option => {
    const text = fold([option.parentPath, option.label].join(' '))
    return terms.every(term => text.includes(term))
  }) : options
  const enabled = visible.filter(option => !option.disabled)
  const active = enabled.find(option => option.value === activeValue) ?? enabled[0]
  const selected = options.find(option => option.value === value)
  const optionId = (option: SearchableOption) => `${listId}-option-${visible.indexOf(option)}`
  const changeOpen = (next: boolean) => {
    setOpen(next)
    setQuery('')
    setActiveValue(next ? value : undefined)
    if (!next) onBlur?.()
  }
  const choose = (option: SearchableOption) => {
    if (option.disabled) return
    onValueChange(option.value)
    changeOpen(false)
  }
  const navigate = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      if (active) choose(active)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const index = active ? enabled.indexOf(active) : -1
      const next = enabled[index + (event.key === 'ArrowDown' ? 1 : -1)]
      if (!next) return
      setActiveValue(next.value)
      document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' })
    }
  }

  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild>
      <button ref={ref} id={id} type="button" role="combobox" aria-label={ariaLabel} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? popupId : undefined} aria-required={required} aria-invalid={invalid} disabled={disabled}
        onBlur={() => { if (!open) onBlur?.() }}
        onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); changeOpen(true) } }}
        className={cn('flex min-h-[46px] w-full min-w-0 items-center justify-between gap-2 rounded-[13px] border border-line bg-surface px-[13px] py-[10px] text-left text-sm text-text outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50 aria-invalid:border-destructive', !selected && 'text-muted', className)}>
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent id={popupId} align="start" aria-label="Elegir categoría" className="z-[80] w-[var(--radix-popover-trigger-width)] min-w-[min(14rem,var(--radix-popover-content-available-width))] max-w-[var(--radix-popover-content-available-width)]">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input role="combobox" aria-label="Buscar categorías" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={active && optionId(active)}
          placeholder="Buscar categorías" autoComplete="off" className="pl-9" value={query}
          onChange={event => { setQuery(event.target.value); setActiveValue(undefined); document.getElementById(listId)?.scrollTo(0, 0) }} onKeyDown={navigate} />
      </div>
      <div id={listId} role="listbox" aria-label="Categorías" className="max-h-[clamp(3rem,calc(var(--radix-popover-content-available-height)-5rem),18rem)] overflow-y-auto overscroll-contain">
        {visible.map((option, index) => <div key={option.value} id={`${listId}-option-${index}`} role="option" tabIndex={-1} aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
          aria-description={option.depth ? `Subcategoría${option.parentPath ? ` de ${option.parentPath}` : ''}` : undefined}
          onClick={() => choose(option)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(option) } }}
          style={{ paddingInlineStart: 8 + Math.min(option.depth ?? 0, 5) * 10 }}
          className={cn('flex min-h-10 cursor-default items-center gap-2 rounded-lg py-2 pr-2 outline-none hover:bg-raised focus-visible:bg-raised aria-disabled:opacity-50', option === active && 'bg-raised')}>
          {option.depth ? <CornerDownRight className="size-4 shrink-0 text-muted" aria-hidden="true" /> : null}
          <span className="min-w-0 flex-1 break-words">{option.label}{query.trim() && option.parentPath ? <small className="block text-xs text-muted" aria-hidden="true">{option.parentPath}</small> : null}</span>
          {option.value === value ? <Check className="size-4 shrink-0 text-accent" aria-hidden="true" /> : null}
        </div>)}
      </div>
      {!visible.length ? <p role="status" className="px-2 pb-2 text-muted">{terms.length ? 'No encontramos categorías.' : 'No hay categorías disponibles.'}</p> : null}
    </PopoverContent>
  </Popover>
}
