import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefCallback } from 'react'
import { AnimatePresence, LayoutGroup, m } from 'motion/react'
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronLeft, ChevronRight, CircleDollarSign,
  CreditCard, Eye, Filter, Landmark, Save, Trash2, X,
  Plus, Search, Settings, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Upload, WalletCards,
} from 'lucide-react'
import { format, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { db, exchangeRateService, financeService, repository } from './data'
import type { Account, Category, CreditCard as CreditCardModel, ExchangeRate, Transaction } from './models'
import { movementFormSchema, onboardingFormSchema, type MovementFormValues, type OnboardingFormValues } from './models/form-schemas'
import { TextField, SelectField } from './components/form-field'
import { DatePicker, DatePickerField, FormSelect } from './components/form-controls'
import { ResponsiveModal } from './components/responsive-modal'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Empty as EmptyRoot, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './components/ui/empty'
import { Field, FieldError } from './components/ui/field'
import { Input } from './components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { Skeleton } from './components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { AppShell, Brand, type View } from './components/app-shell'
import { MercadoPagoImportModal } from './components/mercado-pago-import-modal'
import { AccountsPage } from './components/accounts-page'
import { FinanceToolsPage } from './components/finance-tools-page'
import { CategoriesPage } from './components/categories-page'
import { DatabaseImportButton } from './components/database-backup-controls'
import { MoreMenuPage } from './components/more-menu-page'
import { AmountField, DateField } from './components/movement-fields'
import { IconAction } from './components/icon-action'
import { ConfirmationDialog } from './components/confirmation-dialog'
import { analyticsAmountInArs, pendingUsdConversionCount } from './domain/analytics-currency'
import { formatMoney } from './domain/money'
import { todayLocal } from './domain/date'
import { buildMovementSearchIndex, filterMovements, hasMovementFilters, movementPage, pageForAnchor, type MovementFilterState } from './domain/movement-filter'
import { useMovementGrid } from './hooks/use-movement-grid'
import { motionTransition } from './components/motion-variants'

const FinanceChart = lazy(() => import('./components/FinanceChart'))

type MovementKind = 'expense' | 'income' | 'transfer' | 'balance-adjustment'

const uid = () => crypto.randomUUID()
const primaryPesoAccountId = (accounts: Account[]) =>
  accounts.find(account => account.active && account.currency === 'ARS' && account.name.trim().toLocaleLowerCase('es') === 'cuenta principal')?.id
  ?? accounts.find(account => account.active && account.currency === 'ARS')?.id
  ?? accounts.find(account => account.active)?.id
  ?? ''
const money = (minor: number, currency: 'ARS' | 'USD' = 'ARS') => formatMoney(minor, currency)
const parseMinor = (value: string) => Math.round(Number(value.replace(',', '.')) * 100)
const currencyOptions = [{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]

function useFinanceData() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cards, setCards] = useState<CreditCardModel[]>([])
  const [rate, setRate] = useState<ExchangeRate>()
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    await repository.initialize()
    const values = await Promise.all([
      db.accounts.toArray(), db.categories.toArray(), db.transactions.orderBy('date').reverse().toArray(), db.creditCards.toArray(),
    ])
    const orderedTransactions = values[2].sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
    setAccounts(values[0]); setCategories(values[1]); setTransactions(orderedTransactions); setCards(values[3]); setReady(true)
  }, [])

  const refreshRate = useCallback(async (force = false) => {
    const result = await exchangeRateService.getOfficial({ force })
    await financeService.reconcileUsdRates(result.rate)
    setRate(result.rate)
    await refresh()
    return result
  }, [refresh])

  useEffect(() => {
    let active = true
    void refreshRate().catch(() => {
      void exchangeRateService.latestOfficial().then(cached => {
        if (!active) return
        if (cached) setRate(cached)
        const reconciliation = cached ? financeService.reconcileUsdRates(cached) : Promise.resolve()
        void reconciliation.then(() => { if (active) void refresh() })
      })
    })
    return () => { active = false }
  }, [refresh, refreshRate])
  return { accounts, categories, transactions, cards, rate, ready, refresh, refreshRate }
}

function Onboarding({ onDone }: { onDone: () => Promise<void> }) {
  const form = useForm<OnboardingFormValues>({ resolver: zodResolver(onboardingFormSchema), defaultValues: { name: 'Cuenta principal', balance: '', currency: 'ARS' } })
  const submit = form.handleSubmit(async values => {
    const now = new Date().toISOString()
    await db.accounts.add({ id: uid(), name: values.name, type: 'bank', currency: values.currency, initialBalanceMinor: parseMinor(values.balance || '0'), active: true, createdAt: now, updatedAt: now })
    await onDone()
  })
  return <main className="grid min-h-screen items-center px-[18px] py-6"><div className="mx-auto w-full max-w-[540px]">
    <Brand variant="compact" size="lg" className="mb-[34px]" /><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">Bienvenido a De La Geezy</div>
    <h1 className="mb-[10px] max-w-[680px] text-[clamp(42px,13vw,68px)] leading-[1.02] tracking-[-0.055em]">Tu plata.<br />Más clara.</h1>
    <p className="max-w-[460px] leading-[1.6] text-muted">Arranquemos por lo básico: una cuenta y su saldo actual. Después podés personalizar todo, sin formularios eternos.</p>
    <Card className="relative mt-8 p-[18px]"><form noValidate onSubmit={submit}>
      <div className="mb-[14px] text-xs text-muted">PASO 1 DE 1 · TU PRIMERA CUENTA</div>
      <div className="grid gap-[13px] tablet:grid-cols-2">
        <TextField label="Nombre de la cuenta" registration={form.register('name')} error={form.formState.errors.name} />
        <Controller name="currency" control={form.control} render={({ field }) => <SelectField label="Moneda" name={field.name} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.currency} options={currencyOptions} />} />
        <TextField label="Saldo inicial" registration={form.register('balance')} error={form.formState.errors.balance} inputMode="decimal" placeholder="0,00" />
      </div>
      <Button type="submit" className="mt-[18px] w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Guardando…' : 'Empezar a ordenar mi plata'}</Button>
      <div className="mt-[18px] flex gap-[10px] text-[11px] leading-[1.5] text-muted"><ShieldCheck size={22} /><span>Tus datos quedan en este dispositivo. No los mandamos a ningún servidor.</span></div>
    </form><div className="mt-4 border-t border-line pt-4 text-center"><p className="mb-3 text-xs text-muted">¿Ya usabas De La Geezy en otro dispositivo?</p><DatabaseImportButton className="w-full" label="Restaurar un respaldo" onRestored={onDone} /></div></Card>
  </div></main>
}

function QuickMovement({ open, accounts, categories, onClose, onClosed, onSaved }: { open: boolean; accounts: Account[]; categories: Category[]; onClose: () => void; onClosed: () => void; onSaved: () => Promise<void> }) {
  const wasOpen = useRef(open)
  useEffect(() => {
    const shouldRestoreFocus = wasOpen.current && !open
    wasOpen.current = open
    if (!shouldRestoreFocus) return
    const timer = window.setTimeout(onClosed, 350)
    return () => window.clearTimeout(timer)
  }, [open, onClosed])
  const initialKind: MovementKind = 'expense'
  const initialCategory = categories.find(category => category.kind === 'expense' && !category.archived)?.id ?? ''
  const defaultValues = (): MovementFormValues => ({ kind: initialKind, amount: '', description: '', accountId: primaryPesoAccountId(accounts), destinationAccountId: '', categoryId: initialCategory, date: todayLocal(), status: 'confirmed', adjustmentDirection: 'credit' })
  const form = useForm<MovementFormValues>({ resolver: zodResolver(movementFormSchema), defaultValues: defaultValues() })
  const kind = useWatch({ control: form.control, name: 'kind' })
  const filtered = categories.filter(c => c.kind === (kind === 'income' ? 'income' : 'expense') && !c.archived)
  const submit = form.handleSubmit(async values => {
    try {
      if (values.kind === 'transfer') {
        await financeService.createTransfer({ date: values.date, originAccountId: values.accountId, destinationAccountId: values.destinationAccountId!, amount: values.amount, description: values.description })
      } else {
        const account = accounts.find(a => a.id === values.accountId)!
        await financeService.createMovement({ date: values.date, amount: values.amount, currency: account.currency, type: values.kind, status: values.status, accountId: values.accountId, categoryId: values.categoryId || undefined, adjustmentDirection: values.adjustmentDirection, description: values.description || (values.kind === 'expense' ? 'Gasto' : values.kind === 'income' ? 'Ingreso' : 'Ajuste de saldo') })
      }
      await onSaved()
      form.reset(defaultValues())
      toast.success('Movimiento guardado.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos guardar el movimiento.')
    }
  })
  return <ResponsiveModal open={open} onOpenChange={nextOpen => { if (!nextOpen) onClose() }} onCloseAutoFocus={onClosed} title="Nuevo movimiento" description="Rápido, que la vida sigue."><form noValidate onSubmit={submit}>
    <Tabs value={kind} onValueChange={value => { const type = value as MovementKind; form.setValue('kind', type); const categoryKind = type === 'income' ? 'income' : 'expense'; form.setValue('categoryId', type === 'transfer' || type === 'balance-adjustment' ? '' : (categories.find(category => category.kind === categoryKind && !category.archived)?.id ?? '')); form.clearErrors() }} className="my-[18px]"><TabsList aria-label="Tipo de movimiento" className="grid !h-auto min-h-[54px] w-full grid-cols-2 gap-1 rounded-[14px] border border-line bg-[#13171a] p-[5px] min-[430px]:grid-cols-4">{(['expense', 'income', 'transfer', 'balance-adjustment'] as MovementKind[]).map(type => <TabsTrigger key={type} value={type} className="min-h-11 rounded-[10px] px-2 text-xs text-muted hover:text-text data-[state=active]:bg-raised data-[state=active]:font-semibold data-[state=active]:text-text data-[state=active]:shadow-[0_1px_5px_rgba(0,0,0,0.28)]">{type === 'expense' ? 'Gasto' : type === 'income' ? 'Ingreso' : type === 'transfer' ? 'Transferencia' : 'Ajuste'}</TabsTrigger>)}</TabsList></Tabs>
    <Controller name="amount" control={form.control} render={({ field }) => <AmountField value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.amount} />} />
    <div className="mt-[18px] grid gap-[13px] tablet:grid-cols-2">
      <Controller name="accountId" control={form.control} render={({ field }) => <SelectField label={kind === 'transfer' ? 'Cuenta de origen' : 'Cuenta'} name={field.name} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.accountId} options={accounts.filter(a => a.active).map(a => ({ value: a.id, label: `${a.name} · ${a.currency}` }))} />} />
      {kind === 'expense' || kind === 'income' ? <Controller name="categoryId" control={form.control} render={({ field }) => <SelectField label="Categoría" name={field.name} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.categoryId} options={filtered.map(c => ({ value: c.id, label: c.name }))} />} /> : null}
      {kind === 'transfer' ? <Controller name="destinationAccountId" control={form.control} render={({ field }) => <SelectField label="Cuenta de destino" name={field.name} value={field.value ?? ''} onValueChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.destinationAccountId} options={accounts.filter(a => a.active && a.id !== form.getValues('accountId')).map(a => ({ value: a.id, label: `${a.name} · ${a.currency}` }))} />} /> : null}
      {kind === 'balance-adjustment' ? <Controller name="adjustmentDirection" control={form.control} render={({ field }) => <SelectField label="Dirección" name={field.name} value={field.value ?? 'credit'} onValueChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.adjustmentDirection} options={[{ value: 'credit', label: 'Sumar saldo' }, { value: 'debit', label: 'Restar saldo' }]} />} /> : null}
      <Controller name="date" control={form.control} render={({ field }) => <DateField value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.date} />} />
      {kind !== 'transfer' ? <Controller name="status" control={form.control} render={({ field }) => <SelectField label="Estado" name={field.name} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.status} options={[{ value: 'confirmed', label: 'Confirmado' }, { value: 'pending', label: 'Pendiente' }]} />} /> : null}
      <div className="col-span-full"><TextField label="Descripción o comercio" registration={form.register('description')} error={form.formState.errors.description} placeholder="Ej. Supermercado, sueldo…" /></div>
    </div>
    <div className="mt-[18px] grid grid-cols-[1fr_2fr] gap-[9px]"><Button type="button" variant="outline" onClick={onClose}><X aria-hidden="true" />Cancelar</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Guardando…' : <><Save aria-hidden="true" />Guardar movimiento</>}</Button></div>
  </form></ResponsiveModal>
}

function balanceFor(account: Account, transactions: Transaction[]) {
  return transactions.filter(t => t.status === 'confirmed').reduce((total, t) => {
    if (t.type === 'transfer') {
      if (t.accountId === account.id) return total - t.amountMinor - (t.feeMinor ?? 0)
      if (t.destinationAccountId === account.id) return total + (t.destinationAmountMinor ?? t.amountMinor)
      return total
    }
    if (t.accountId !== account.id) return total
    if (t.type === 'income' || (t.type === 'balance-adjustment' && t.adjustmentDirection !== 'debit')) return total + t.amountMinor
    if (t.type === 'balance-adjustment' && t.adjustmentDirection === 'debit') return total - t.amountMinor
    if (t.type === 'expense' || t.type === 'card-payment' || t.type === 'debt-payment') return total - t.amountMinor
    return total
  }, account.initialBalanceMinor)
}

function MonthSelector({ month, onMonth, className = '' }: { month: Date; onMonth: (date: Date) => void; className?: string }) {
  return <div className={`flex items-center justify-between gap-[10px] ${className}`}><div className="flex items-center gap-1.5"><IconAction variant="ghost" size="icon-sm" icon={ChevronLeft} label="Mes anterior" onClick={() => onMonth(subMonths(month, 1))} /><strong className="min-w-[110px] text-center text-sm capitalize">{format(month, 'MMMM yyyy', { locale: es })}</strong><IconAction variant="ghost" size="icon-sm" icon={ChevronRight} label="Mes siguiente" onClick={() => onMonth(subMonths(month, -1))} /></div><Button type="button" variant="outline" size="sm" onClick={() => onMonth(startOfMonth(new Date()))}>Este mes</Button></div>
}

function Dashboard({ accounts, transactions, categories, rate, month, onMonth, onAdd, onNavigate }: { accounts: Account[]; transactions: Transaction[]; categories: Category[]; rate?: ExchangeRate; month: Date; onMonth: (d: Date) => void; onAdd: () => void; onNavigate: (v: View) => void }) {
  const key = format(month, 'yyyy-MM')
  const monthly = transactions.filter(t => t.date.startsWith(key) && t.status === 'confirmed')
  const valuedMonthly = monthly.flatMap(transaction => { const value = analyticsAmountInArs(transaction); return value === null ? [] : [{ transaction, value }] })
  const income = valuedMonthly.filter(item => item.transaction.type === 'income').reduce((sum, item) => sum + item.value, 0)
  const expense = valuedMonthly.filter(item => item.transaction.type === 'expense').reduce((sum, item) => sum + item.value, 0)
  const pendingConversions = pendingUsdConversionCount(monthly)
  const ars = accounts.filter(a => a.currency === 'ARS' && a.active).reduce((s, a) => s + balanceFor(a, transactions), 0)
  const usd = accounts.filter(a => a.currency === 'USD' && a.active).reduce((s, a) => s + balanceFor(a, transactions), 0)
  const usdInArs = rate ? Math.round(usd * rate.sell) : undefined
  const totalInArs = usdInArs === undefined ? undefined : ars + usdInArs
  const categoryMap = new Map(categories.map(c => [c.id, c]))
  const byCategory = Array.from(valuedMonthly.filter(item => item.transaction.type === 'expense').reduce((map, item) => map.set(item.transaction.categoryId ?? 'other', (map.get(item.transaction.categoryId ?? 'other') ?? 0) + item.value), new Map<string, number>()))
    .map(([id, value]) => ({ name: categoryMap.get(id)?.name ?? 'Otros', value, color: categoryMap.get(id)?.color ?? '#AAB3B1' })).sort((a, b) => b.value - a.value)
  return <>
    <div className="mb-6"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">PANORAMA GENERAL</div><h1 className="mb-[10px] max-w-[680px] text-[clamp(30px,7vw,52px)] leading-[1.02] tracking-[-0.055em]">La billetera no miente.</h1><p className="text-sm text-muted">Todo lo importante, sin tener que abrir una planilla.</p></div>
    <MonthSelector month={month} onMonth={onMonth} className="mb-[14px] mt-[22px]" />
    {pendingConversions ? <div role="status" className="mb-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">{pendingConversions} {pendingConversions === 1 ? 'operación USD todavía no tiene' : 'operaciones USD todavía no tienen'} cotización histórica y no se incluye en los totales ARS.</div> : null}
    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 desktop:grid-cols-[2fr_repeat(4,1fr)]">
      <div className="relative col-span-full min-h-[164px] overflow-hidden rounded-[20px] border border-line bg-[linear-gradient(145deg,rgba(41,47,51,0.97),rgba(32,38,41,0.95))] p-[18px] shadow-[0_12px_38px_rgba(0,0,0,0.12)] after:absolute after:-right-[70px] after:-top-20 after:size-40 after:rounded-full after:border-[35px] after:border-[rgba(197,242,119,0.08)] after:content-[''] tablet:col-span-1"><div className="flex items-center gap-[7px] text-xs text-muted"><WalletCards size={15} /> Saldo líquido confirmado</div><div className="mb-[5px] mt-[14px] text-[clamp(22px,6vw,36px)] font-bold tracking-[-0.045em]">{money(ars)}</div><div className="text-[11px] text-muted">{usd ? `${money(usd, 'USD')} en cuentas USD${usdInArs !== undefined ? ` ≈ ${money(usdInArs)}` : ''} · ` : ''}{accounts.length} {accounts.length === 1 ? 'cuenta activa' : 'cuentas activas'}</div>{rate ? <div className="relative z-10 mt-3 inline-flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-black/10 px-2.5 py-1.5 text-[10px] text-muted"><span>Dólar oficial venta {money(Math.round(rate.sell * 100))}</span>{totalInArs !== undefined ? <strong className="text-text">Total estimado {money(totalInArs)}</strong> : null}</div> : null}</div>
      <div className="relative min-h-[124px] overflow-hidden rounded-[20px] border border-line bg-[rgba(32,38,41,0.86)] p-[18px] shadow-[0_12px_38px_rgba(0,0,0,0.12)]"><div className="flex items-center gap-[7px] text-xs text-muted"><ArrowDownLeft size={15} /> Ingresos reales</div><div className="mb-[5px] mt-[14px] text-[clamp(22px,6vw,36px)] font-bold tracking-[-0.045em] text-success">{money(income)}</div><div className="text-[11px] text-muted">Confirmados · convertidos a ARS</div></div>
      <div className="relative min-h-[124px] overflow-hidden rounded-[20px] border border-line bg-[rgba(32,38,41,0.86)] p-[18px] shadow-[0_12px_38px_rgba(0,0,0,0.12)]"><div className="flex items-center gap-[7px] text-xs text-muted"><ArrowUpRight size={15} /> Gastos</div><div className="mb-[5px] mt-[14px] text-[clamp(22px,6vw,36px)] font-bold tracking-[-0.045em] text-danger">{money(expense)}</div><div className="text-[11px] text-muted">Consumo · convertido a ARS</div></div>
      <div className="relative min-h-[124px] overflow-hidden rounded-[20px] border border-line bg-[rgba(32,38,41,0.86)] p-[18px] shadow-[0_12px_38px_rgba(0,0,0,0.12)]"><div className="flex items-center gap-[7px] text-xs text-muted"><Sparkles size={15} /> Resultado</div><div className={`mb-[5px] mt-[14px] text-[clamp(22px,6vw,36px)] font-bold tracking-[-0.045em] ${income - expense >= 0 ? 'text-success' : 'text-danger'}`}>{money(income - expense)}</div><div className="text-[11px] text-muted">Ingresos menos gastos</div></div>
    </div>
    <div className="mt-3">
      <div className="relative min-h-[300px] overflow-hidden rounded-[20px] border border-line bg-[rgba(32,38,41,0.86)] p-[18px] shadow-[0_12px_38px_rgba(0,0,0,0.12)]"><div className="mb-[18px] flex flex-col items-start gap-[10px] min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between"><div><h2 className="mb-1 text-xl tracking-[-0.03em]">¿A dónde se fue la guita?</h2><p className="m-0 text-xs text-muted">Gastos por categoría · ARS con cotizaciones guardadas</p></div><Button type="button" variant="outline" size="sm" onClick={() => onNavigate('analysis')}>Ver análisis</Button></div>
        {byCategory.length ? <Suspense fallback={<div className="h-[230px]" aria-hidden="true" />}><FinanceChart kind="bar" data={byCategory} formatValue={money} /></Suspense> : <Empty title="Todavía no hay gastos" copy="Cuando cargues el primero, acá vas a ver qué categoría se está comiendo el presupuesto." action="Registrar gasto" onAction={onAdd} />}
      </div>
    </div>
  </>
}

function Empty({ title, copy, action, onAction }: { title: string; copy: string; action?: string; onAction?: () => void }) {
  return <EmptyRoot className="min-h-[220px] border-0 px-[18px] py-7"><EmptyHeader><EmptyMedia className="relative mb-[18px] grid size-[104px] place-items-center rounded-full bg-[rgba(197,242,119,0.05)] text-accent before:absolute before:inset-[13px] before:rounded-full before:border before:border-[rgba(197,242,119,0.16)] before:content-[''] after:absolute after:inset-7 after:rounded-full after:border after:border-[rgba(197,242,119,0.16)] after:content-['']"><Eye size={25} /></EmptyMedia><EmptyTitle className="text-base">{title}</EmptyTitle><EmptyDescription className="max-w-80 text-[13px] text-muted">{copy}</EmptyDescription></EmptyHeader>{action && <EmptyContent><Button type="button" onClick={onAction}><Plus size={16} />{action}</Button></EmptyContent>}</EmptyRoot>
}

type MovementRowProps = {
  transaction: Transaction
  accountName: string
  onEdit: (transaction: Transaction) => void
  onDelete: (id: string) => Promise<void>
}

function movementTone(type: Transaction['type']) {
  if (type === 'transfer') return { icon: ArrowLeftRight, iconClass: 'bg-surface text-muted', amountClass: '', prefix: '' }
  if (type === 'income') return { icon: TrendingUp, iconClass: 'bg-[rgba(130,209,162,0.12)] text-success', amountClass: 'text-success', prefix: '+' }
  return { icon: TrendingDown, iconClass: 'bg-danger/10 text-danger', amountClass: 'text-danger', prefix: '−' }
}

function MovementActions({ transaction, onDelete }: Pick<MovementRowProps, 'transaction' | 'onDelete'>) {
  return <div className="flex gap-1" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}><ConfirmationDialog trigger={<IconAction variant="ghost" size="icon-xs" className="size-11 tablet:size-6" icon={Trash2} label={`Eliminar movimiento ${transaction.description}`} />} title="¿Eliminar este movimiento?" description="El registro se borrará y todos los saldos se recalcularán." confirmLabel="Eliminar" pendingLabel="Eliminando…" variant="destructive" onConfirm={() => onDelete(transaction.id)} /></div>
}

function MovementRow({ transaction, accountName, onEdit, onDelete }: MovementRowProps) {
  const tone = movementTone(transaction.type); const Icon = tone.icon
  const canEdit = ['income', 'expense', 'balance-adjustment'].includes(transaction.type) && !transaction.cardId
  const openEditor = () => { if (canEdit) onEdit(transaction) }
  return <Card data-testid="movement-row" role={canEdit ? 'button' : undefined} tabIndex={canEdit ? 0 : undefined} aria-label={canEdit ? `Editar movimiento ${transaction.description}` : undefined} onClick={openEditor} onKeyDown={event => { if (event.target !== event.currentTarget || !canEdit || (event.key !== 'Enter' && event.key !== ' ')) return; event.preventDefault(); openEditor() }} className={`min-w-0 flex-row items-center gap-2 rounded-xl px-2.5 py-2 ${canEdit ? 'cursor-pointer hover:border-primary/25 hover:bg-raised/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''}`}><div data-testid="movement-icon" data-movement-type={transaction.type} className={`grid size-8 flex-[0_0_32px] place-items-center rounded-[10px] ${tone.iconClass}`}><Icon size={15} /></div><div className="min-w-0 flex-1"><strong className="block truncate text-sm leading-tight">{transaction.description}</strong><div className="mt-0.5 truncate whitespace-nowrap text-[11px] text-muted">{accountName} · {format(new Date(`${transaction.date}T12:00:00`), 'dd MMM', { locale: es })}</div></div><div className="flex shrink-0 items-center gap-1"><div data-testid="movement-amount" className={`text-right text-sm font-bold tabular-nums ${tone.amountClass}`}>{tone.prefix}{money(transaction.amountMinor, transaction.currency)}</div><MovementActions transaction={transaction} onDelete={onDelete} /></div></Card>
}

function MovementEditor({ editing, accounts, categories, onClose, onUpdate }: { editing: Transaction; accounts: Account[]; categories: Category[]; onClose: () => void; onUpdate: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (saving) return; setSaving(true)
    try {
      const data = new FormData(event.currentTarget); const accountId = String(data.get('edit-account')); const account = accounts.find(item => item.id === accountId)!
      await financeService.updateMovement(editing.id, { date: String(data.get('edit-date')), amount: String(data.get('edit-amount')), currency: account.currency, type: editing.type as 'income' | 'expense' | 'balance-adjustment', status: String(data.get('edit-status')) as Transaction['status'], accountId, categoryId: String(data.get('edit-category') || '') || undefined, description: String(data.get('edit-description')), notes: String(data.get('edit-notes') || ''), tags: editing.tags, adjustmentDirection: editing.adjustmentDirection })
      await onUpdate(); toast.success('Movimiento actualizado.'); onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos actualizar el movimiento.')
    } finally { setSaving(false) }
  }
  return <ResponsiveModal open onOpenChange={open => { if (!open && !saving) onClose() }} title="Editar movimiento"><form className="grid gap-3" onSubmit={submit}>{[['Descripción', 'edit-description', editing.description], ['Importe', 'edit-amount', String(editing.amountMinor / 100)], ['Notas', 'edit-notes', editing.notes ?? '']].map(([label, name, defaultValue]) => <label key={name} className="grid gap-1 text-sm">{label}<Input name={name} defaultValue={defaultValue} required={name !== 'edit-notes'} /></label>)}<DatePickerField label="Fecha" name="edit-date" defaultValue={editing.date} required /><FormSelect label="Cuenta" name="edit-account" defaultValue={editing.accountId} required options={accounts.filter(account => account.active || account.id === editing.accountId).map(account => ({ value: account.id, label: account.name }))} /><FormSelect label="Categoría" name="edit-category" defaultValue={editing.categoryId} required options={categories.filter(category => !category.archived && category.kind === editing.type).map(category => ({ value: category.id, label: category.name }))} /><FormSelect label="Estado" name="edit-status" defaultValue={editing.status} required options={[{ value: 'confirmed', label: 'Confirmado' }, { value: 'pending', label: 'Pendiente' }, { value: 'skipped', label: 'Omitido' }]} /><div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}><X aria-hidden="true" />Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Guardando…' : <><Save aria-hidden="true" />Guardar</>}</Button></div></form></ResponsiveModal>
}

function MovementFiltersPanel({ active, count, filters, accounts, categories, onFilter, onReset }: { active: boolean; count: number; filters: MovementFilterState; accounts: Account[]; categories: Category[]; onFilter: (key: keyof MovementFilterState, value: string) => void; onReset: () => void }) {
  return <Card id="movement-filters" className="mb-4 gap-3 rounded-2xl p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm">Filtrar movimientos</strong>{active ? <Button type="button" variant="ghost" size="sm" onClick={onReset}>Limpiar filtros</Button> : null}</div><div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-4"><Select value={filters.type} onValueChange={value => onFilter('type', value)}><SelectTrigger aria-label="Tipo de movimiento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos</SelectItem><SelectItem value="expense">Gastos</SelectItem><SelectItem value="income">Ingresos</SelectItem><SelectItem value="transfer">Transferencias</SelectItem></SelectContent></Select><Select value={filters.status} onValueChange={value => onFilter('status', value)}><SelectTrigger aria-label="Estado del movimiento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="confirmed">Confirmados</SelectItem><SelectItem value="pending">Pendientes</SelectItem></SelectContent></Select><Select value={filters.account} onValueChange={value => onFilter('account', value)}><SelectTrigger aria-label="Cuenta del movimiento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las cuentas</SelectItem>{accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select><Select value={filters.category} onValueChange={value => onFilter('category', value)}><SelectTrigger aria-label="Categoría del movimiento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las categorías</SelectItem>{categories.filter(category => !category.archived).map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select><div className="grid gap-1.5"><span className="text-xs text-muted">Desde</span><DatePicker value={filters.dateFrom} onValueChange={value => onFilter('dateFrom', value)} ariaLabel="Fecha desde" /></div><div className="grid gap-1.5"><span className="text-xs text-muted">Hasta</span><DatePicker value={filters.dateTo} onValueChange={value => onFilter('dateTo', value)} ariaLabel="Fecha hasta" /></div></div><div className="text-xs text-muted" aria-live="polite">{count} {count === 1 ? 'movimiento encontrado' : 'movimientos encontrados'}</div></Card>
}

function MovementCollection({ transactions, accountNames, query, activeFilters, containerRef, columns, onEdit, onDelete, onAdd }: { transactions: Transaction[]; accountNames: Map<string, string>; query: string; activeFilters: boolean; containerRef: RefCallback<HTMLDivElement>; columns: number; onEdit: MovementRowProps['onEdit']; onDelete: MovementRowProps['onDelete']; onAdd: () => void }) {
  if (!transactions.length) return <Card className="p-[18px]"><Empty title={query || activeFilters ? 'No encontramos nada' : 'Acá van tus movimientos'} copy={query || activeFilters ? 'Probá con otros filtros o una búsqueda distinta.' : 'Ingresos, gastos y transferencias van a aparecer en orden cronológico.'} action={!query && !activeFilters ? 'Registrar el primero' : undefined} onAction={onAdd} /></Card>
  return <m.div ref={containerRef} layout className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} transition={{ layout: motionTransition.layout }}>{transactions.map(transaction => <m.div layout="position" key={transaction.id} transition={{ layout: motionTransition.layout }}><MovementRow transaction={transaction} accountName={accountNames.get(transaction.accountId ?? '') ?? 'Sin cuenta'} onEdit={onEdit} onDelete={onDelete} /></m.div>)}</m.div>
}

function Movements({ transactions, categories, accounts, onAdd, onImport, onDelete, onUpdate }: { transactions: Transaction[]; categories: Category[]; accounts: Account[]; onAdd: () => void; onImport: () => void; onDelete: (id: string) => Promise<void>; onUpdate: () => Promise<void> }) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFromFilter, setDateFromFilter] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateToFilter, setDateToFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const previousPageSize = useRef(25)
  const { containerRef, columnCount, pageSize } = useMovementGrid()
  const cats = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories])
  const accs = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts])
  const searchIndex = useMemo(() => buildMovementSearchIndex(transactions, cats), [transactions, cats])
  const filters = useMemo<MovementFilterState>(() => ({ query: deferredQuery, type: typeFilter, status: statusFilter, account: accountFilter, category: categoryFilter, dateFrom: dateFromFilter, dateTo: dateToFilter }), [deferredQuery, typeFilter, statusFilter, accountFilter, categoryFilter, dateFromFilter, dateToFilter])
  const hasFilters = hasMovementFilters(filters)
  const filtered = useMemo(() => filterMovements(searchIndex, filters), [searchIndex, filters])
  const pagination = useMemo(() => movementPage(filtered, page, pageSize), [filtered, page, pageSize])
  const filterSetters = { query: setQuery, type: setTypeFilter, status: setStatusFilter, account: setAccountFilter, category: setCategoryFilter, dateFrom: setDateFromFilter, dateTo: setDateToFilter }
  const setFilter = (key: keyof MovementFilterState, value: string) => { filterSetters[key](value); setPage(1) }
  const resetFilters = () => { setTypeFilter('all'); setStatusFilter('all'); setAccountFilter('all'); setCategoryFilter('all'); setDateFromFilter(''); setDateToFilter(''); setPage(1) }
  useLayoutEffect(() => {
    const oldSize = previousPageSize.current
    if (oldSize === pageSize) return
    setPage(current => pageForAnchor((current - 1) * oldSize, pageSize))
    previousPageSize.current = pageSize
  }, [pageSize])
  return <><div className="mb-6"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">HISTORIAL</div><h1 className="mb-[10px] max-w-[680px] text-[clamp(30px,7vw,52px)] leading-[1.02] tracking-[-0.055em]">Movimientos</h1><p className="text-sm text-muted">Cada peso con su historia. Buscá, filtrá y revisá.</p></div><div className="mb-4 flex flex-wrap gap-2"><div className="relative min-w-full flex-1 tablet:min-w-[180px]"><Search size={17} className="absolute left-[13px] top-[14px] z-10 text-muted" /><Input ref={searchInputRef} aria-label="Buscar movimientos" className={`pl-10 ${query ? 'pr-12' : ''}`} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Buscar comercio o categoría" />{query ? <IconAction type="button" variant="ghost" size="icon-xs" icon={X} label="Limpiar búsqueda" className="absolute right-0.5 top-0.5 size-11 tablet:size-10" onClick={() => { setQuery(''); setPage(1); searchInputRef.current?.focus() }} /> : null}</div><Button type="button" className="min-w-0 flex-1 tablet:flex-none" variant="outline" onClick={onImport}><Upload size={17} /> <span>Importar resumen</span></Button><IconAction variant={hasFilters ? 'secondary' : 'outline'} icon={Filter} label={hasFilters ? 'Filtrar, hay filtros activos' : 'Filtrar'} aria-expanded={filtersOpen} aria-controls="movement-filters" onClick={() => setFiltersOpen(open => !open)} /><Button type="button" className="min-w-0" onClick={onAdd}><Plus size={17} /> <span>Nuevo</span></Button></div>
    <LayoutGroup><AnimatePresence initial={false}>{filtersOpen ? <m.div key="movement-filters" initial={{ opacity: 0, scaleY: 0.96, y: -8 }} animate={{ opacity: 1, scaleY: 1, y: 0 }} exit={{ opacity: 0, scaleY: 0.96, y: -8 }} transition={motionTransition.standard} className="origin-top overflow-hidden"><MovementFiltersPanel active={hasFilters} count={filtered.length} filters={filters} accounts={accounts} categories={categories} onFilter={setFilter} onReset={resetFilters} /></m.div> : null}</AnimatePresence>
    <m.div layout transition={{ layout: motionTransition.layout }}><MovementCollection transactions={pagination.items} accountNames={accs} query={query} activeFilters={hasFilters} containerRef={containerRef} columns={columnCount} onEdit={setEditing} onDelete={onDelete} onAdd={onAdd} /></m.div></LayoutGroup>
    {filtered.length ? <nav aria-label="Paginación de movimientos" className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted"><span>Mostrando {pagination.from}–{pagination.to} de {filtered.length}</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" className="min-h-11" disabled={pagination.page === 1} onClick={() => setPage(Math.max(1, pagination.page - 1))}><ChevronLeft aria-hidden="true" />Anterior</Button><span className="min-w-[78px] text-center" aria-live="polite">Página {pagination.page} de {pagination.totalPages}</span><Button type="button" variant="outline" size="sm" className="min-h-11" disabled={pagination.page === pagination.totalPages} onClick={() => setPage(Math.min(pagination.totalPages, pagination.page + 1))}>Siguiente<ChevronRight aria-hidden="true" /></Button></div></nav> : null}
    {editing ? <MovementEditor editing={editing} accounts={accounts} categories={categories} onClose={() => setEditing(null)} onUpdate={onUpdate} /> : null}
  </>
}

function Accounts({ accounts, cards, transactions, rate, onRefresh }: { accounts: Account[]; cards: CreditCardModel[]; transactions: Transaction[]; rate?: ExchangeRate; onRefresh: () => Promise<void> }) {
  return <AccountsPage accounts={accounts} cards={cards} transactions={transactions} rate={rate} onRefresh={onRefresh} />
}

function AnalyticsRanking({ title, items }: { title: string; items: { name: string; value: number }[] }) {
  return <Card className="min-w-0 p-4"><h2 className="mb-3 text-base">{title}</h2><div className="grid gap-2">{items.length ? items.map(item => <div key={item.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm"><span className="truncate text-muted">{item.name}</span><strong className="shrink-0 text-right tabular-nums">{money(item.value)}</strong></div>) : <span className="text-sm text-muted">Sin datos.</span>}</div></Card>
}

function Analysis({ transactions, categories, accounts, cards, month, onMonth }: { transactions: Transaction[]; categories: Category[]; accounts: Account[]; cards: CreditCardModel[]; month: Date; onMonth: (date: Date) => void }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const currentKey = format(month, 'yyyy-MM'); const previousKey = format(subMonths(month, 1), 'yyyy-MM')
  const confirmed = transactions.filter(t => t.status === 'confirmed')
  const selected = confirmed.filter(t => t.date.startsWith(currentKey))
  const consumption = selected.filter(t => t.type === 'expense')
  const pendingConversions = pendingUsdConversionCount(selected)
  const categoriesById = new Map(categories.map(c => [c.id, c])); const accountsById = new Map(accounts.map(a => [a.id, a.name])); const cardsById = new Map(cards.map(c => [c.id, c.name]))
  const group = (items: Transaction[], label: (item: Transaction) => string) => Array.from(items.reduce((map, item) => { const value = analyticsAmountInArs(item); return value === null ? map : map.set(label(item), (map.get(label(item)) ?? 0) + value) }, new Map<string, number>())).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const data = group(consumption, item => categoriesById.get(item.categoryId ?? '')?.name ?? 'Otros').map((item, index) => ({ ...item, color: categories[index % categories.length]?.color ?? '#AAB3B1' }))
  const concepts = group(consumption, item => item.description).slice(0, 5); const byAccount = group(consumption.filter(t => t.accountId), item => accountsById.get(item.accountId ?? '') ?? 'Sin cuenta').slice(0, 5); const byCard = group(consumption.filter(t => t.cardId), item => cardsById.get(item.cardId ?? '') ?? 'Tarjeta').slice(0, 5)
  const totals = (key: string) => { const month = confirmed.filter(t => t.date.startsWith(key)); const valued = month.flatMap(transaction => { const value = analyticsAmountInArs(transaction); return value === null ? [] : [{ transaction, value }] }); const income = valued.filter(item => item.transaction.type === 'income').reduce((sum, item) => sum + item.value, 0); const expense = valued.filter(item => item.transaction.type === 'expense').reduce((sum, item) => sum + item.value, 0); return { income, expense, result: income - expense } }
  const current = totals(currentKey); const previous = totals(previousKey); const savingsRate = current.income ? ((current.result / current.income) * 100).toFixed(1) : '0.0'; const total = data.reduce((sum, item) => sum + item.value, 0)
  return <><div className="mb-6"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">BAJO LA LUPA</div><h1 className="mb-[10px] max-w-[680px] text-[clamp(30px,7vw,52px)] leading-[1.02] tracking-[-0.055em]">Entender para decidir.</h1><p className="text-sm text-muted">Analizá tus gastos confirmados por categoría, concepto y medio de pago.</p></div>
    <MonthSelector month={month} onMonth={date => { setSelectedCategory(null); onMonth(date) }} className="mb-4" />
    {pendingConversions ? <div role="status" className="mb-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">{pendingConversions} {pendingConversions === 1 ? 'operación USD todavía no tiene' : 'operaciones USD todavía no tienen'} cotización histórica y no se incluye en los totales ARS.</div> : null}
    <div className="mb-4 grid gap-3 min-[430px]:grid-cols-2 desktop:grid-cols-4"><Card className="p-4"><span className="text-xs text-muted">Ingresos del mes</span><strong className="mt-2 block text-xl text-success">{money(current.income)}</strong></Card><Card className="p-4"><span className="text-xs text-muted">Gastos del mes</span><strong className="mt-2 block text-xl text-danger">{money(current.expense)}</strong></Card><Card className="p-4"><span className="text-xs text-muted">Resultado vs. mes anterior</span><strong className="mt-2 block text-xl">{money(current.result)}</strong><span className="text-xs text-muted">Anterior {money(previous.result)}</span></Card><Card className="p-4"><span className="text-xs text-muted">Tasa de ahorro</span><strong className="mt-2 block text-xl">{savingsRate}%</strong></Card></div>
    {data.length ? <Card className="p-5"><h2 className="mb-1 text-xl">Distribución por categoría</h2><p className="text-xs text-muted">Fecha de consumo · ARS con cotizaciones guardadas</p><div className="mt-3 grid items-center gap-x-6 gap-y-2 min-[700px]:grid-cols-[minmax(260px,1fr)_minmax(280px,0.9fr)]"><Suspense fallback={<div className="h-[220px]" aria-hidden="true" />}><FinanceChart kind="pie" data={data} formatValue={money} totalLabel={money(total)} /></Suspense><div aria-label="Categorías">{data.map(item => <Button type="button" variant="ghost" className="grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center justify-stretch gap-2 border-b border-line px-2 py-2.5 text-sm" key={item.name} onClick={() => setSelectedCategory(item.name)}><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" /><span className="min-w-0 text-left"><span className="block truncate">{item.name}</span><small className="block text-muted">{total ? ((item.value / total) * 100).toFixed(1) : 0}% · ver movimientos</small></span><strong className="shrink-0 tabular-nums">{money(item.value)}</strong></Button>)}</div></div></Card> : <Card className="p-5"><Empty title="Todavía no hay nada para analizar" copy="Los gráficos se construyen sólo con tus movimientos reales." /></Card>}
    {selectedCategory ? <Card className="mt-4 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg">Movimientos de {selectedCategory}</h2><Button size="sm" variant="ghost" onClick={() => setSelectedCategory(null)}>Cerrar</Button></div><div className="grid gap-2">{consumption.filter(item => (categoriesById.get(item.categoryId ?? '')?.name ?? 'Otros') === selectedCategory).map(item => { const converted = analyticsAmountInArs(item); return <div key={item.id} className="flex justify-between gap-3 rounded-xl bg-raised p-3 text-sm"><span>{item.description}<small className="block text-muted">{item.date}</small></span><span className="text-right"><strong>{money(item.amountMinor, item.currency)}</strong>{item.currency === 'USD' && converted !== null ? <small className="block text-muted">{money(converted)} histórico</small> : null}</span></div> })}</div></Card> : null}
    <div className="mt-4 grid gap-3 tablet:grid-cols-3"><AnalyticsRanking title="Conceptos" items={concepts} /><AnalyticsRanking title="Cuentas" items={byAccount} /><AnalyticsRanking title="Tarjetas" items={byCard} /></div></>
}

export default function App() {
  const { accounts, categories, transactions, cards, rate, ready, refresh, refreshRate } = useFinanceData()
  const [view, setView] = useState<View>('dashboard'); const [adding, setAdding] = useState(false); const [importing, setImporting] = useState(false); const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const addTrigger = useRef<HTMLElement | null>(null)
  const openAdd = (trigger?: HTMLElement) => { addTrigger.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null); setAdding(true) }
  const closeAdd = () => setAdding(false)
  if (!ready) return <main className="grid min-h-screen items-center px-[18px] py-6"><div className="mx-auto w-full max-w-[540px]"><Brand /><div className="mt-[30px] space-y-3" aria-label="Ordenando los números"><Skeleton className="h-4 w-44 bg-raised" /><Skeleton className="h-24 w-full rounded-[20px] bg-surface" /></div></div></main>
  if (!accounts.length) return <Onboarding onDone={refresh} />
  const content = (() => {
    if (view === 'dashboard') return <Dashboard accounts={accounts} transactions={transactions} categories={categories} rate={rate} month={month} onMonth={setMonth} onAdd={openAdd} onNavigate={setView} />
    if (view === 'movements') return <Movements transactions={transactions} categories={categories} accounts={accounts} onAdd={openAdd} onImport={() => setImporting(true)} onDelete={async id => { try { await financeService.deleteMovement(id); await refresh(); toast.success('Movimiento eliminado.') } catch (error) { toast.error(error instanceof Error ? error.message : 'No pudimos eliminar el movimiento.') } }} onUpdate={refresh} />
    if (view === 'accounts') return <Accounts accounts={accounts} cards={cards} transactions={transactions} rate={rate} onRefresh={refresh} />
    if (view === 'analysis') return <Analysis transactions={transactions} categories={categories} accounts={accounts} cards={cards} month={month} onMonth={setMonth} />
    if (view === 'categories') return <CategoriesPage categories={categories} onRefresh={refresh} />
    if (view === 'more') return <MoreMenuPage onNavigate={setView} />
    return <FinanceToolsPage accounts={accounts} categories={categories} cards={cards} rate={rate} onRateRefresh={refreshRate} onRefresh={refresh} />
  })()
  return <AppShell view={view} onNavigate={setView} onAdd={openAdd}>{content}<QuickMovement open={adding} accounts={accounts} categories={categories} onClose={closeAdd} onClosed={() => addTrigger.current?.focus()} onSaved={refresh} />{importing && <MercadoPagoImportModal accounts={accounts} categories={categories} onClose={() => setImporting(false)} onImported={refresh} />}</AppShell>
}
