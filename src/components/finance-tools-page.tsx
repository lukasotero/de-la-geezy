import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Bell, CalendarClock, Check, CircleDollarSign, LoaderCircle, Pause, Play, RefreshCw, RotateCw, Save, SkipForward } from 'lucide-react'
import { toast } from 'sonner'
import { db, financeService } from '@/data'
import type { Account, CardPayment, CardPurchase, CardStatement, Category, CreditCard as CreditCardModel, Debt, ExchangeRate, Installment, RecurringOccurrence, RecurringRule } from '@/models'
import { formatMoney } from '@/domain/money'
import { todayLocal } from '@/domain/date'
import { CardRelationsPanel } from './card-relations-panel'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { DatePickerField, FormSelect } from './form-controls'
import { IconAction } from './icon-action'
import { DatabaseBackupCard } from './database-backup-controls'

type Props = { accounts: Account[]; categories: Category[]; cards: CreditCardModel[]; rate?: ExchangeRate; onRateRefresh: (force?: boolean) => Promise<{ rate: ExchangeRate; fresh: boolean; warning?: string }>; onRefresh: () => Promise<void> }
const money = (minor: number, currency: 'ARS' | 'USD') => formatMoney(minor, currency)
const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
const SectionTitle = ({ icon: Icon, title, copy }: { icon: typeof Bell; title: string; copy: string }) => <div className="mb-3 flex items-start gap-2.5"><div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-accent"><Icon size={16} aria-hidden="true" /></div><div className="min-w-0"><h2 className="text-base leading-tight">{title}</h2><p className="mt-0.5 text-xs leading-snug text-muted">{copy}</p></div></div>
const Field = ({ label, name, type = 'text', defaultValue, required = false, min, step, className }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean; min?: string; step?: string; className?: string }) => <div className={`grid gap-1 ${className ?? ''}`}><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} min={min} step={step} /></div>

export function FinanceToolsPage({ accounts, categories, cards, rate, onRateRefresh, onRefresh }: Props) {
  const [rules, setRules] = useState<RecurringRule[]>([]); const [occurrences, setOccurrences] = useState<RecurringOccurrence[]>([])
  const [debts, setDebts] = useState<Debt[]>([]); const [statements, setStatements] = useState<CardStatement[]>([])
  const [purchases, setPurchases] = useState<CardPurchase[]>([]); const [installments, setInstallments] = useState<Installment[]>([]); const [payments, setPayments] = useState<CardPayment[]>([])
  const [pending, setPending] = useState<Set<string>>(() => new Set()); const [rateWarning, setRateWarning] = useState('')
  const pendingRef = useRef(new Set<string>())
  const load = useCallback(async () => {
    await financeService.reconcileRecurring(todayLocal()); await financeService.buildStatements()
    const [nextRules, nextOccurrences, nextDebts, nextStatements, nextPurchases, nextInstallments, nextPayments] = await Promise.all([
      db.recurringRules.toArray(), db.recurringOccurrences.orderBy('scheduledDate').reverse().toArray(), db.debts.toArray(),
      db.cardStatements.orderBy('dueDate').reverse().toArray(), db.cardPurchases.orderBy('purchaseDate').reverse().toArray(), db.installments.toArray(), db.cardPayments.orderBy('date').reverse().toArray(),
    ])
    setRules(nextRules); setOccurrences(nextOccurrences); setDebts(nextDebts); setStatements(nextStatements); setPurchases(nextPurchases); setInstallments(nextInstallments); setPayments(nextPayments)
  }, [])
  useEffect(() => { void load() }, [load])
  const run = async (action: () => Promise<unknown>, success: string, key = 'global'): Promise<boolean> => {
    if (pendingRef.current.has(key)) return false
    pendingRef.current.add(key)
    setPending(current => new Set(current).add(key))
    const toastId = toast.loading('Procesando…')
    try {
      await action(); await Promise.all([load(), onRefresh()]); toast.success(success, { id: toastId }); return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos completar la operación.', { id: toastId }); return false
    } finally {
      pendingRef.current.delete(key)
      setPending(current => { const next = new Set(current); next.delete(key); return next })
    }
  }
  const createRecurring = (form: HTMLFormElement) => run(async () => {
    const data = new FormData(form); const categoryId = value(data, 'recurring-category'); const category = categories.find(item => item.id === categoryId)
    await financeService.saveRecurringRule({ kind: category?.kind ?? 'expense', description: value(data, 'recurring-description'), amountMinor: Math.round(Number(value(data, 'recurring-amount').replace(',', '.')) * 100),
      currency: value(data, 'recurring-currency') as 'ARS' | 'USD', categoryId, suggestedAccountId: value(data, 'recurring-account'), frequency: value(data, 'recurring-frequency') as RecurringRule['frequency'],
      nextDate: value(data, 'recurring-date'), autoGenerate: false, active: true })
    form.reset()
  }, 'Recurrente guardado.', 'recurring:create')

  const createDebt = (form: HTMLFormElement) => run(async () => {
    const data = new FormData(form); const principal = Math.round(Number(value(data, 'debt-amount').replace(',', '.')) * 100)
    await financeService.saveDebt({ name: value(data, 'debt-name'), creditor: value(data, 'debt-creditor'), initialPrincipalMinor: principal, outstandingMinor: principal,
      currency: value(data, 'debt-currency') as 'ARS' | 'USD', dueDate: value(data, 'debt-date') || undefined, annualInterestRate: Number(value(data, 'debt-rate')) || undefined, active: true })
    form.reset()
  }, 'Deuda guardada.', 'debt:create')

  const payDebt = async (event: FormEvent<HTMLFormElement>, debt: Debt) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const success = await run(() => financeService.payDebt({ debtId: debt.id, accountId: value(data, `debt-account-${debt.id}`), date: todayLocal(), principal: value(data, `debt-principal-${debt.id}`), interest: value(data, `debt-interest-${debt.id}`) }), 'Pago de deuda registrado.')
    if (success) form.reset()
  }

  return <div className="tools-compact min-[430px]:[&_button[data-size=default]]:min-h-10 min-[430px]:[&_input[data-slot=input]]:min-h-10 min-[430px]:[&_input[data-slot=input]]:py-2 min-[430px]:[&_button[data-slot=select-trigger]]:min-h-10 min-[430px]:[&_button[data-slot=select-trigger]]:py-2"><div className="mb-5"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">OPERACIONES Y CONFIGURACIÓN</div><h1 className="mb-1.5 text-[clamp(30px,7vw,52px)] leading-none tracking-[-0.05em]">Más herramientas</h1><p className="text-sm text-muted">Tarjetas, recurrentes, deudas y privacidad local.</p></div>
    <div className="grid items-start gap-3 desktop:block desktop:columns-2 desktop:gap-3 desktop:[&>[data-slot=card]]:mb-3 desktop:[&>[data-slot=card]]:w-full desktop:[&>[data-slot=card]]:break-inside-avoid">
      <DatabaseBackupCard onRestored={onRefresh} />
      <Card className="self-start p-4"><SectionTitle icon={CircleDollarSign} title="Cotización ARS/USD" copy="Se actualiza automáticamente desde Dólar API y cada operación conserva su tasa histórica." /><div className="mb-3 text-sm leading-snug">{rate ? <><div className="mb-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3.5 py-3"><span className="block text-xs text-muted">Dólar oficial venta</span><strong className="mt-0.5 block text-xl tracking-[-0.025em] text-text">$ {rate.sell}</strong></div><div className="text-muted">Consultada {new Date(rate.fetchedAt).toLocaleString('es-AR')}{rate.sourceUpdatedAt ? <><br />Fuente actualizada {new Date(rate.sourceUpdatedAt).toLocaleString('es-AR')}</> : null}<br /><span className={Date.now() - new Date(rate.fetchedAt).getTime() < 6 * 60 * 60 * 1000 ? 'text-success' : 'text-accent'}>{Date.now() - new Date(rate.fetchedAt).getTime() < 6 * 60 * 60 * 1000 ? 'Cotización vigente' : 'Cotización desactualizada'}</span></div></> : 'Todavía no hay una cotización oficial disponible.'}</div>{rateWarning ? <p role="status" className="mb-2.5 text-xs text-accent">{rateWarning}</p> : null}<Button onClick={() => void run(async () => { const result = await onRateRefresh(true); setRateWarning(result.warning ?? '') }, 'Cotización consultada.')}><RefreshCw />Actualizar oficial</Button>
      </Card>

      <Card className="self-start p-4"><SectionTitle icon={CalendarClock} title="Recurrentes" copy="Alquiler, servicios, suscripciones e ingresos periódicos." /><form className="grid gap-2.5 min-[430px]:grid-cols-2" onSubmit={event => { event.preventDefault(); void createRecurring(event.currentTarget) }}><Field label="Concepto" name="recurring-description" required /><div className="grid grid-cols-[1fr_90px] gap-2.5"><Field label="Importe" name="recurring-amount" type="number" min="0.01" step="0.01" required /><FormSelect className="gap-1" label="Moneda" name="recurring-currency" defaultValue="ARS" required options={[{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]} /></div><FormSelect className="gap-1" label="Categoría" name="recurring-category" required options={categories.filter(c => !c.archived).map(c => ({ value: c.id, label: c.name }))} /><FormSelect className="gap-1" label="Cuenta sugerida" name="recurring-account" defaultValue={accounts.find(a => a.active)?.id} required options={accounts.filter(a => a.active).map(a => ({ value: a.id, label: a.name }))} /><FormSelect className="gap-1" label="Frecuencia" name="recurring-frequency" defaultValue="monthly" required options={[{ value: 'monthly', label: 'Mensual' }, { value: 'weekly', label: 'Semanal' }, { value: 'quarterly', label: 'Trimestral' }, { value: 'yearly', label: 'Anual' }]} /><DatePickerField className="gap-1" label="Próxima fecha" name="recurring-date" defaultValue={todayLocal()} required /><Button className="min-[430px]:col-span-2" type="submit" disabled={pending.has('recurring:create')}>{pending.has('recurring:create') ? <><LoaderCircle className="animate-spin" />Guardando…</> : 'Crear recurrente'}</Button></form>
        <div className="mt-3 grid gap-1.5">{rules.map(rule => <form key={rule.id} className="grid gap-1.5 rounded-xl border border-line p-2.5 text-sm min-[430px]:grid-cols-[1fr_110px_auto] min-[430px]:items-center" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void run(() => financeService.saveRecurringRule({ ...rule, description: value(data, `rule-name-${rule.id}`), amountMinor: Math.round(Number(value(data, `rule-amount-${rule.id}`)) * 100) }, rule.id), 'Recurrente actualizado.') }}><Input aria-label={`Concepto de ${rule.description}`} name={`rule-name-${rule.id}`} defaultValue={rule.description} /><Input aria-label={`Importe de ${rule.description}`} name={`rule-amount-${rule.id}`} type="number" min="0.01" step="0.01" defaultValue={rule.amountMinor / 100} /><div className="flex gap-1"><IconAction size="icon-sm" type="submit" variant="outline" icon={Save} label={`Guardar recurrente ${rule.description}`} /><IconAction size="icon-sm" variant="outline" icon={rule.active ? Pause : Play} label={`${rule.active ? 'Pausar' : 'Activar'} recurrente ${rule.description}`} onClick={() => void run(async () => db.recurringRules.put({ ...rule, active: !rule.active, updatedAt: new Date().toISOString() }), rule.active ? 'Recurrente pausado.' : 'Recurrente reactivado.')} /></div></form>)}</div>
        {occurrences.filter(o => o.status === 'pending').map(occurrence => { const rule = rules.find(r => r.id === occurrence.ruleId); const description = rule?.description ?? 'recurrente'; return <form key={occurrence.id} className="mt-1.5 grid gap-1.5 rounded-xl bg-raised p-2.5 text-sm min-[430px]:grid-cols-[1fr_140px_auto] min-[430px]:items-center" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void run(() => financeService.rescheduleOccurrence(occurrence.id, value(data, `occurrence-date-${occurrence.id}`)), 'Ocurrencia reprogramada.') }}><span>{rule?.description ?? 'Recurrente'}</span><DatePickerField ariaLabel={`Fecha de ${description}`} name={`occurrence-date-${occurrence.id}`} defaultValue={occurrence.scheduledDate} required /><div className="flex flex-wrap gap-1"><IconAction size="icon-sm" type="submit" variant="outline" icon={RotateCw} label={`Reprogramar ${description}`} /><IconAction size="icon-sm" icon={Check} label={`Confirmar ${description}`} onClick={() => void run(() => financeService.resolveOccurrence(occurrence.id, 'confirm', { accountId: rule?.suggestedAccountId }), 'Movimiento confirmado.')} /><IconAction size="icon-sm" variant="outline" icon={SkipForward} label={`Omitir ${description}`} onClick={() => void run(() => financeService.resolveOccurrence(occurrence.id, 'skip'), 'Ocurrencia omitida.')} /></div></form> })}
      </Card>

      <CardRelationsPanel accounts={accounts} cards={cards} categories={categories} purchases={purchases} installments={installments} statements={statements} payments={payments} run={run} />

      <Card className="self-start p-4"><SectionTitle icon={CircleDollarSign} title="Deudas" copy="Capital, intereses y cargos permanecen separados." /><form className="grid gap-2.5 min-[430px]:grid-cols-2" onSubmit={event => { event.preventDefault(); void createDebt(event.currentTarget) }}><Field label="Nombre" name="debt-name" required /><Field label="Acreedor" name="debt-creditor" required /><Field label="Capital" name="debt-amount" type="number" min="0.01" step="0.01" required /><FormSelect className="gap-1" label="Moneda" name="debt-currency" defaultValue="ARS" required options={[{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]} /><DatePickerField className="gap-1" label="Vencimiento" name="debt-date" /><Field label="Tasa anual %" name="debt-rate" type="number" min="0" step="0.01" /><Button className="min-[430px]:col-span-2" type="submit" disabled={pending.has('debt:create')}>{pending.has('debt:create') ? <><LoaderCircle className="animate-spin" />Guardando…</> : 'Crear deuda'}</Button></form>
        <div className="mt-3 grid gap-1.5">{debts.map(debt => <form key={debt.id} className="grid gap-2 rounded-xl border border-line p-2.5" onSubmit={event => void payDebt(event, debt)}><div className="text-sm leading-snug"><strong>{debt.name}</strong> · {debt.creditor}<br /><span className="text-muted">Capital pendiente {money(debt.outstandingMinor, debt.currency)}</span></div>{debt.active ? <><div className="grid gap-2 min-[430px]:grid-cols-2"><FormSelect className="gap-1" label="Cuenta" name={`debt-account-${debt.id}`} defaultValue={accounts.find(a => a.active && a.currency === debt.currency)?.id} required options={accounts.filter(a => a.active && a.currency === debt.currency).map(a => ({ value: a.id, label: a.name }))} /><div className="grid grid-cols-2 gap-2"><Field label="Capital" name={`debt-principal-${debt.id}`} type="number" min="0.01" step="0.01" required /><Field label="Interés" name={`debt-interest-${debt.id}`} type="number" min="0" step="0.01" /></div></div><Button size="sm" type="submit">Registrar pago</Button></> : <span className="text-xs text-success">Cancelada</span>}</form>)}</div>
      </Card>

    </div></div>
}
