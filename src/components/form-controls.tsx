import { useEffect, useId, useRef, useState } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { format, isValid, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const EMPTY_OPTION = '__form-control-empty__'

type FormSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type FormValueProps = {
  name: string
  defaultValue?: string
  required?: boolean
  disabled?: boolean
}

function useResettableValue(defaultValue: string | undefined) {
  const [value, setValue] = useState<string | undefined>(defaultValue)
  const controlRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const form = controlRef.current?.closest('form')
    if (!form) return
    const reset = () => queueMicrotask(() => setValue(defaultValue))
    form.addEventListener('reset', reset)
    return () => form.removeEventListener('reset', reset)
  }, [defaultValue])

  return { value, setValue, controlRef }
}

function FormValue({ name, value, required, disabled, onInvalid }: FormValueProps & { value: string; onInvalid: () => void }) {
  return <input
    aria-hidden="true"
    className="pointer-events-none absolute size-px opacity-0"
    name={name}
    value={value}
    required={required}
    disabled={disabled}
    tabIndex={-1}
    onChange={() => undefined}
    onInvalid={event => { event.preventDefault(); onInvalid() }}
  />
}

type FormSelectProps = FormValueProps & {
  label: string
  options: FormSelectOption[]
  placeholder?: string
  className?: string
  triggerClassName?: string
}

export function FormSelect({ name, label, options, defaultValue, required, disabled, placeholder = 'Elegí una opción', className, triggerClassName }: FormSelectProps) {
  const { value, setValue, controlRef } = useResettableValue(defaultValue)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const radixValue = value === '' ? EMPTY_OPTION : value

  return <div className={cn('relative grid gap-1.5', className)}>
    <Label htmlFor={name}>{label}</Label>
    <Select value={radixValue ?? ''} onValueChange={next => setValue(next === EMPTY_OPTION ? '' : next)} disabled={disabled}>
      <SelectTrigger ref={node => { triggerRef.current = node; controlRef.current = node }} id={name} aria-required={required} className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{options.map(option => <SelectItem key={option.value || EMPTY_OPTION} value={option.value || EMPTY_OPTION} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
    <FormValue name={name} value={value ?? ''} required={required} disabled={disabled} onInvalid={() => triggerRef.current?.focus()} />
  </div>
}

type DatePickerProps = {
  id?: string
  value?: string
  onValueChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

export function DatePicker({ id, value, onValueChange, required, disabled, ariaLabel, className }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const parsed = value ? parseISO(value) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined
  const displayValue = selected ? format(selected, 'dd/MM/yyyy') : 'Elegí una fecha'

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button id={id} type="button" variant="outline" disabled={disabled} aria-label={ariaLabel ? `${ariaLabel}: ${displayValue}` : undefined} className={cn('w-full justify-between px-3 font-normal text-foreground', !selected && 'text-muted', className)}>
        {displayValue}
        <CalendarIcon className="text-muted" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto p-0">
      <Calendar mode="single" selected={selected} defaultMonth={selected} locale={es} onSelect={date => { if (!date) return; onValueChange(format(date, 'yyyy-MM-dd')); setOpen(false) }} />
      {!required && value ? <div className="border-t border-line p-2"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { onValueChange(''); setOpen(false) }}><X aria-hidden="true" />Limpiar fecha</Button></div> : null}
    </PopoverContent>
  </Popover>
}

type DatePickerFieldProps = FormValueProps & {
  label?: string
  ariaLabel?: string
  className?: string
  buttonClassName?: string
}

export function DatePickerField({ name, label, ariaLabel, defaultValue, required, disabled, className, buttonClassName }: DatePickerFieldProps) {
  const generatedId = useId()
  const id = name || generatedId
  const { value, setValue, controlRef } = useResettableValue(defaultValue)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return <div className={cn('relative grid gap-1.5', className)} ref={node => { controlRef.current = node }}>
    {label ? <Label htmlFor={id}>{label}</Label> : null}
    <div ref={node => { triggerRef.current = node?.querySelector('button') ?? null }}>
      <DatePicker id={id} value={value} onValueChange={setValue} required={required} disabled={disabled} ariaLabel={label ? undefined : ariaLabel} className={buttonClassName} />
    </div>
    <FormValue name={name} value={value ?? ''} required={required} disabled={disabled} onInvalid={() => triggerRef.current?.focus()} />
  </div>
}
