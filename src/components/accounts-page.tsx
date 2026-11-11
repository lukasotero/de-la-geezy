import { useState } from 'react'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, type FieldError } from 'react-hook-form'
import { Archive, ArchiveRestore, CreditCard, Landmark, Pencil, Plus, Save, X } from 'lucide-react'
import { db } from '@/data'
import type { Account, CardBrand, CreditCard as CreditCardModel, ExchangeRate, Transaction } from '@/models'
import { assetFormSchema, type AssetFormValues } from '@/models/form-schemas'
import { formatCardDate, getCardCycle } from '@/domain/card-cycle'
import { formatMoney } from '@/domain/money'
import { TextField, SelectField } from '@/components/form-field'
import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { IconAction } from '@/components/icon-action'
import { ConfirmationDialog } from '@/components/confirmation-dialog'

const uid = () => crypto.randomUUID()
const parseMinor = (value: string) => Math.round(Number(value.replace(',', '.')) * 100)
const money = (minor: number, currency: 'ARS' | 'USD') => formatMoney(minor, currency)
const currencyOptions = [{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]
const accountTypeOptions = [
  { value: 'bank', label: 'Cuenta bancaria' }, { value: 'wallet', label: 'Billetera virtual' },
  { value: 'cash', label: 'Efectivo' }, { value: 'savings', label: 'Ahorro' },
]
const cardBrandOptions = ['Visa', 'Mastercard', 'American Express', 'Cabal', 'Naranja X', 'Otra'].map(value => ({ value, label: value }))

const cardThemes: Record<CardBrand, string> = {
  Visa: 'from-[#143d7a] via-[#102e5d] to-[#091a36]',
  Mastercard: 'from-[#5d211e] via-[#321d25] to-[#171923]',
  'American Express': 'from-[#16677a] via-[#174957] to-[#102b34]',
  Cabal: 'from-[#6b2038] via-[#421c31] to-[#221825]',
  'Naranja X': 'from-[#a74713] via-[#6c2b16] to-[#281b19]',
  Otra: 'from-[#3c4850] via-[#29343a] to-[#182126]',
}

function balanceFor(account: Account, transactions: Transaction[]) {
  return transactions.filter(transaction => transaction.status === 'confirmed').reduce((total, transaction) => {
    if (transaction.type === 'transfer') {
      if (transaction.accountId === account.id) return total - transaction.amountMinor - (transaction.feeMinor ?? 0)
      if (transaction.destinationAccountId === account.id) return total + (transaction.destinationAmountMinor ?? transaction.amountMinor)
      return total
    }
    if (transaction.accountId !== account.id) return total
    if (transaction.type === 'income' || (transaction.type === 'balance-adjustment' && transaction.adjustmentDirection !== 'debit')) return total + transaction.amountMinor
    if (transaction.type === 'balance-adjustment' && transaction.adjustmentDirection === 'debit') return total - transaction.amountMinor
    if (transaction.type === 'expense' || transaction.type === 'card-payment' || transaction.type === 'debt-payment') return total - transaction.amountMinor
    return total
  }, account.initialBalanceMinor)
}

function accountTypeLabel(type: Account['type']) {
  if (type === 'wallet') return 'Billetera virtual'
  if (type === 'savings') return 'Ahorro'
  if (type === 'cash') return 'Efectivo'
  return 'Cuenta bancaria'
}

function CreditCardVisual({ card }: { card: CreditCardModel }) {
  const brand: CardBrand = card.brand in cardThemes ? card.brand : 'Otra'
  return <div data-testid="credit-card-visual" data-card-brand={brand} className={`relative aspect-[1.586/1] w-full overflow-hidden rounded-[22px] border border-white/15 bg-gradient-to-br ${cardThemes[brand]} p-5 text-white shadow-[0_18px_38px_rgba(0,0,0,0.28)]`}>
    <div className="absolute -right-12 -top-16 size-48 rounded-full border border-white/10" aria-hidden="true" />
    <div className="absolute -bottom-24 -left-16 size-56 rounded-full bg-white/[0.035]" aria-hidden="true" />
    <div className="relative flex h-full flex-col justify-between">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-[11px] text-white/65">{card.issuer}</div><div className="mt-1 truncate text-sm font-semibold">{card.name}</div></div><CreditCard size={19} className="shrink-0 text-white/70" aria-hidden="true" /></div>
      <div className="h-7 w-10 rounded-md border border-[#f5d98c]/40 bg-[linear-gradient(135deg,#d6b968,#f2dd9a_48%,#b9984e)] shadow-inner" aria-hidden="true" />
      <div className="flex items-end justify-between gap-3"><span className="text-sm tracking-[0.2em] text-white/80">{card.lastFour ? `•••• ${card.lastFour}` : '•••• ••••'}</span><strong className="text-right text-sm tracking-[-0.02em]">{brand}</strong></div>
    </div>
  </div>
}

function EmptyCards({ onAdd }: { onAdd: () => void }) {
  return <Card><Empty><EmptyHeader><EmptyMedia variant="icon"><CreditCard /></EmptyMedia><EmptyTitle>Sin tarjetas cargadas</EmptyTitle><EmptyDescription>Agregá una para identificar sus fechas y futuros consumos.</EmptyDescription></EmptyHeader><EmptyContent><Button type="button" variant="outline" size="sm" onClick={onAdd}>Agregar tarjeta</Button></EmptyContent></Empty></Card>
}

type AssetEditor = { mode: 'account'; item?: Account; currencyLocked: boolean } | { mode: 'card'; item?: CreditCardModel; currencyLocked: boolean }

type Props = { accounts: Account[]; cards: CreditCardModel[]; transactions: Transaction[]; rate?: ExchangeRate; onRefresh: () => Promise<void> }

export function AccountsPage({ accounts, cards, transactions, rate, onRefresh }: Props) {
  const [editor, setEditor] = useState<AssetEditor | null>(null)
  const [pendingAction, setPendingAction] = useState<string>()
  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: { mode: 'account', name: '', balance: '', currency: 'ARS', accountType: 'bank' },
  })
  const closeEditor = () => { if (!form.formState.isSubmitting) setEditor(null) }
  const openNew = (mode: 'account' | 'card') => {
    form.clearErrors()
    if (mode === 'account') form.reset({ mode, name: '', balance: '', currency: 'ARS', accountType: 'bank' })
    else form.reset({ mode, name: '', issuer: '', brand: 'Otra', lastFour: '', closingDay: '', dueDay: '', currency: 'ARS' })
    setEditor({ mode, currencyLocked: false })
  }
  const openAccount = (item: Account) => {
    form.clearErrors()
    form.reset({ mode: 'account', name: item.name, balance: String(item.initialBalanceMinor / 100).replace('.', ','), currency: item.currency, accountType: item.type })
    setEditor({ mode: 'account', item, currencyLocked: transactions.some(transaction => transaction.accountId === item.id || transaction.destinationAccountId === item.id) })
  }
  const openCard = async (item: CreditCardModel) => {
    form.clearErrors()
    form.reset({ mode: 'card', name: item.name, issuer: item.issuer, brand: item.brand in cardThemes ? item.brand : 'Otra', lastFour: item.lastFour ?? '', closingDay: item.closingDay?.toString() ?? '', dueDay: item.dueDay?.toString() ?? '', currency: item.currency })
    const related = await Promise.all([
      db.cardPurchases.where('cardId').equals(item.id).count(),
      db.cardStatements.where('cardId').equals(item.id).count(),
      db.cardPayments.where('cardId').equals(item.id).count(),
    ])
    setEditor({ mode: 'card', item, currencyLocked: related.some(Boolean) })
  }
  const save = form.handleSubmit(async values => {
    try {
      const now = new Date().toISOString()
      if (values.mode === 'account') {
        const item = editor?.mode === 'account' ? editor.item : undefined
        const currencyLocked = Boolean(item && transactions.some(transaction => transaction.accountId === item.id || transaction.destinationAccountId === item.id))
        const currency = item && currencyLocked ? item.currency : values.currency
        if (item) await db.accounts.put({ ...item, name: values.name, type: values.accountType, currency, initialBalanceMinor: parseMinor(values.balance || '0'), updatedAt: now })
        else await db.accounts.add({ id: uid(), name: values.name, type: values.accountType, currency, initialBalanceMinor: parseMinor(values.balance || '0'), active: true, createdAt: now, updatedAt: now })
      } else {
        const item = editor?.mode === 'card' ? editor.item : undefined
        const related = item ? await Promise.all([
          db.cardPurchases.where('cardId').equals(item.id).count(),
          db.cardStatements.where('cardId').equals(item.id).count(),
          db.cardPayments.where('cardId').equals(item.id).count(),
        ]) : []
        const currency = item && related.some(Boolean) ? item.currency : values.currency
        const cardValues = {
          name: values.name, issuer: values.issuer, brand: values.brand, currency,
          lastFour: values.lastFour || undefined,
          closingDay: values.closingDay ? Number(values.closingDay) : undefined,
          dueDay: values.dueDay ? Number(values.dueDay) : undefined,
        }
        if (item) await db.creditCards.put({ ...item, ...cardValues, updatedAt: now })
        else await db.creditCards.add({ id: uid(), ...cardValues, active: true, createdAt: now, updatedAt: now })
      }
      await onRefresh()
      toast.success(editing ? 'Cambios guardados.' : values.mode === 'account' ? 'Cuenta guardada.' : 'Tarjeta guardada.')
      setEditor(null)
    } catch {
      toast.error('No pudimos guardar los cambios. Probá de nuevo.')
      form.setError('root', { type: 'server', message: 'No pudimos guardar los cambios. Probá de nuevo.' })
    }
  })
  const toggleActive = async (kind: 'account' | 'card', item: Account | CreditCardModel) => {
    const key = `${kind}:${item.id}`
    if (pendingAction === key) return
    setPendingAction(key)
    try {
      const next = { ...item, active: !item.active, updatedAt: new Date().toISOString() }
      if (kind === 'account') await db.accounts.put(next as Account)
      else await db.creditCards.put(next as CreditCardModel)
      await onRefresh()
      toast.success(`${kind === 'account' ? 'Cuenta' : 'Tarjeta'} ${item.active ? 'archivada' : 'restaurada'}.`)
      return true
    } catch {
      toast.error('No pudimos completar la operación.')
      return false
    } finally {
      setPendingAction(undefined)
    }
  }
  const archiveAction = (kind: 'account' | 'card', item: Account | CreditCardModel, variant: 'ghost' | 'outline') => item.active
    ? <ConfirmationDialog trigger={<IconAction variant={variant} size="icon-sm" icon={Archive} label={`Archivar ${kind === 'account' ? 'cuenta' : 'tarjeta'} ${item.name}`} />} title={`¿Archivar esta ${kind === 'account' ? 'cuenta' : 'tarjeta'}?`} description={<>La {kind === 'account' ? 'cuenta' : 'tarjeta'} <strong>{item.name}</strong> dejará de aparecer entre las opciones activas. Su historial se conserva.</>} confirmLabel="Archivar" pendingLabel="Archivando…" onConfirm={() => toggleActive(kind, item)} />
    : <IconAction variant={variant} size="icon-sm" icon={ArchiveRestore} loading={pendingAction === `${kind}:${item.id}`} label={`Restaurar ${kind === 'account' ? 'cuenta' : 'tarjeta'} ${item.name}`} onClick={() => void toggleActive(kind, item)} />
  const mode = editor?.mode
  const editing = Boolean(editor?.item)
  const errors = form.formState.errors as typeof form.formState.errors & Partial<Record<'accountType' | 'balance' | 'issuer' | 'brand' | 'lastFour' | 'closingDay' | 'dueDay', FieldError>>

  return <><div className="mb-6"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">TU PLATA</div><h1 className="mb-[10px] max-w-[680px] text-[clamp(30px,7vw,52px)] leading-[1.02] tracking-[-0.055em]">Cuentas y tarjetas</h1><p className="text-sm text-muted">Fondos disponibles y consumos, sin mezclar peras con manzanas.</p></div>
    <div className="mb-[18px] flex flex-col items-start gap-[10px] min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between"><div><h2 className="mb-1 text-xl tracking-[-0.03em]">Cuentas</h2><p className="m-0 text-xs text-muted">El saldo inicial no cuenta como ingreso.</p></div><Button type="button" variant="outline" size="sm" onClick={() => openNew('account')}><Plus size={16} /> Nueva cuenta</Button></div>
    {rate ? <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span>Dólar oficial venta</span><strong className="text-text">{money(Math.round(rate.sell * 100), 'ARS')}</strong></div> : null}
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">{accounts.map(account => { const balance = balanceFor(account, transactions); const converted = rate ? account.currency === 'USD' ? Math.round(balance * rate.sell) : Math.round(balance / rate.sell) : undefined; const convertedCurrency = account.currency === 'USD' ? 'ARS' : 'USD'; return <Card className="p-[18px]" key={account.id}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-[7px] text-xs text-muted"><Landmark size={16} /> {accountTypeLabel(account.type)}</div><div className="flex gap-1"><IconAction variant="ghost" size="icon-sm" icon={Pencil} label={`Editar cuenta ${account.name}`} onClick={() => openAccount(account)} />{archiveAction('account', account, 'ghost')}</div></div><div className="mb-[5px] mt-[14px] text-[clamp(22px,6vw,36px)] font-bold tracking-[-0.045em]">{money(balance, account.currency)}</div>{converted !== undefined ? <div className="mb-2 text-xs text-muted">≈ {money(converted, convertedCurrency)}</div> : null}<h3 className="mb-1 text-[15px]">{account.name}</h3><div className="text-[11px] text-muted">Saldo confirmado · {account.currency}</div></Card> })}</div>
    <div className="mb-[18px] mt-[30px] flex flex-col items-start gap-[10px] min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between"><div><h2 className="mb-1 text-xl tracking-[-0.03em]">Tarjetas de crédito</h2><p className="m-0 text-xs text-muted">La compra es el gasto; el pago sólo cancela deuda.</p></div><Button type="button" variant="outline" size="sm" onClick={() => openNew('card')}><Plus size={16} /> Nueva tarjeta</Button></div>
    {cards.length ? <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),360px))] gap-4">{cards.map(card => {
      const cycle = card.closingDay && card.dueDay ? getCardCycle(card.closingDay, card.dueDay) : null
      const closingLabel = cycle ? formatCardDate(cycle.closingDate) : card.closingDay ? `día ${card.closingDay} · mes sin definir` : 'Sin definir'
      const dueLabel = cycle ? formatCardDate(cycle.dueDate) : card.dueDay ? `día ${card.dueDay} · mes sin definir` : 'Sin definir'
      return <Card className="gap-3 p-3" key={card.id}><CreditCardVisual card={card} /><div className="flex items-center justify-between gap-3 px-1 pb-1"><div className="min-w-0 text-[11px] text-muted"><div>Cierre: {closingLabel}</div><div>Vencimiento: {dueLabel} · {card.currency}</div></div><div className="flex gap-1"><IconAction variant="outline" size="icon-sm" icon={Pencil} label={`Editar tarjeta ${card.name}`} onClick={() => void openCard(card)} />{archiveAction('card', card, 'outline')}</div></div></Card>
    })}</div> : <EmptyCards onAdd={() => openNew('card')} />}
    {editor && <ResponsiveModal open onOpenChange={open => { if (!open) closeEditor() }} title={`${editing ? 'Editar' : 'Nueva'} ${mode === 'account' ? 'cuenta' : 'tarjeta'}`} description={mode === 'card' ? 'Las fechas figuran en el resumen o la app de tu banco.' : undefined}><form noValidate onSubmit={save}>
      {form.formState.errors.root?.message && <div role="alert" className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{form.formState.errors.root.message}</div>}
      {mode === 'account' ? <div className="grid gap-[13px] tablet:grid-cols-2">
        <TextField label="Nombre" registration={form.register('name')} error={form.formState.errors.name} />
        <Controller name="accountType" control={form.control} render={({ field }) => <SelectField label="Tipo" name={field.name} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={errors.accountType} options={accountTypeOptions} />} />
        <TextField label="Saldo inicial" registration={form.register('balance')} error={errors.balance} inputMode="decimal" placeholder="0,00" />
        <Controller name="currency" control={form.control} render={({ field }) => <SelectField label="Moneda" name={field.name} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.currency} options={currencyOptions} disabled={editor.currencyLocked} />} />
        {editing && <p className="m-0 text-xs leading-relaxed text-muted tablet:col-span-2">Cambiar el saldo inicial recalcula todos los saldos. {editor.currencyLocked ? 'La moneda no se puede cambiar porque esta cuenta ya tiene movimientos.' : ''}</p>}
      </div> : <div className="grid gap-[13px] tablet:grid-cols-2">
        <TextField label="Nombre de la tarjeta" registration={form.register('name')} error={form.formState.errors.name} placeholder="Ej. Platinum" />
        <TextField label="Banco o emisor" registration={form.register('issuer')} error={errors.issuer} placeholder="Ej. BBVA" />
        <Controller name="brand" control={form.control} render={({ field }) => <SelectField label="Marca" name={field.name} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={errors.brand} options={cardBrandOptions} />} />
        <TextField label="Últimos 4 números (opcional)" registration={form.register('lastFour')} error={errors.lastFour} inputMode="numeric" maxLength={4} placeholder="1234" autoComplete="off" />
        <TextField label="Día de cierre (opcional)" registration={form.register('closingDay')} error={errors.closingDay} inputMode="numeric" placeholder="1 a 31" />
        <TextField label="Día de vencimiento (opcional)" registration={form.register('dueDay')} error={errors.dueDay} inputMode="numeric" placeholder="1 a 31" />
        <Controller name="currency" control={form.control} render={({ field }) => <SelectField label="Moneda" name={field.name} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.currency} options={currencyOptions} disabled={editor.currencyLocked} />} />
        {editor.currencyLocked && <p className="m-0 text-xs leading-relaxed text-muted tablet:col-span-2">La moneda no se puede cambiar porque esta tarjeta ya tiene operaciones asociadas.</p>}
      </div>}
      <div className="mt-[18px] grid grid-cols-[1fr_2fr] gap-[9px]"><Button type="button" variant="outline" onClick={closeEditor}><X aria-hidden="true" />Cancelar</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Guardando…' : <><Save aria-hidden="true" />{editing ? 'Guardar cambios' : 'Guardar'}</>}</Button></div>
    </form></ResponsiveModal>}
  </>
}
