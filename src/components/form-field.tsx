import type { FieldError as HookFormFieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CategorySelect, type SearchableOption } from '@/components/category-select'

type BaseProps = {
  label: string
  error?: HookFormFieldError
}

export function TextField({ label, error, registration, ...props }: BaseProps & { registration: UseFormRegisterReturn } & Omit<React.ComponentProps<typeof Input>, 'name'>) {
  const id = registration.name
  return <Field data-invalid={Boolean(error)}>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Input id={id} aria-invalid={Boolean(error)} {...registration} {...props} />
    <FieldError errors={[error]} />
  </Field>
}

type SelectFieldProps = BaseProps & {
  name: string
  value: string
  onValueChange: (value: string) => void
  onBlur?: () => void
  options: SearchableOption[]
  searchable?: boolean
  placeholder?: string
  disabled?: boolean
}

export function SelectField({ label, error, name, value, onValueChange, onBlur, options, searchable, placeholder = 'Elegí una opción', disabled }: SelectFieldProps) {
  return <Field data-invalid={Boolean(error)}>
    <FieldLabel htmlFor={name}>{label}</FieldLabel>
    {searchable ? <>
      <CategorySelect id={name} value={value} onValueChange={onValueChange} onBlur={onBlur} options={options} placeholder={placeholder} disabled={disabled} invalid={Boolean(error)} />
      <input type="hidden" name={name} value={value} disabled={disabled} />
    </> : <Select name={name} value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={name} aria-invalid={Boolean(error)} onBlur={onBlur}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent>
    </Select>}
    <FieldError errors={[error]} />
  </Field>
}
