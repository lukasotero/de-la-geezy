import type { FieldError as HookFormFieldError } from 'react-hook-form'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/form-controls'
import { displayArgentineAmount, formatArgentineAmount, normalizeArgentineAmount } from '@/components/movement-field-format'

export function AmountField({ value, onChange, onBlur, error }: { value: string; onChange: (value: string) => void; onBlur: () => void; error?: HookFormFieldError }) {
  return <Field data-invalid={Boolean(error)} className="gap-1">
    <div className="flex items-baseline gap-2 border-b border-line px-0 pb-5 pt-[14px]">
      <span className="text-lg text-muted">$</span>
      <Input className="h-auto min-h-0 border-0 bg-transparent p-0 text-[clamp(38px,14vw,58px)] font-bold tracking-[-0.06em] shadow-none focus-visible:ring-0 md:text-[58px]" aria-label="Importe" aria-invalid={Boolean(error)} inputMode="decimal" placeholder="0" value={displayArgentineAmount(value)} onBlur={onBlur} onChange={event => { const formatted = formatArgentineAmount(event.target.value); onChange(normalizeArgentineAmount(formatted)) }} />
    </div>
    <FieldError errors={[error]} />
  </Field>
}

export function DateField({ value, onChange, onBlur, error }: { value: string; onChange: (value: string) => void; onBlur: () => void; error?: HookFormFieldError }) {
  return <Field data-invalid={Boolean(error)}>
    <FieldLabel htmlFor="movement-date">Fecha</FieldLabel>
    <DatePicker id="movement-date" value={value} onValueChange={next => { onChange(next); onBlur() }} required />
    <FieldError errors={[error]} />
  </Field>
}
