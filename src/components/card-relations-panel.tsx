import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Ban, CreditCard as CreditCardIcon, Pencil, Save } from 'lucide-react'
import type { Account, CardPayment, CardPurchase, CardStatement, Category, CreditCard, Currency, Installment } from '@/models'
import { financeService } from '@/data/finance-service'
import { formatMoney } from '@/domain/money'
import { todayLocal } from '@/domain/date'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResponsiveModal } from '@/components/responsive-modal'
import { DatePickerField, FormSelect } from '@/components/form-controls'
import { IconAction } from '@/components/icon-action'

type Props = {
  accounts: Account[]
  cards: CreditCard[]
  categories: Category[]
  purchases: CardPurchase[]
  installments: Installment[]
  statements: CardStatement[]
  payments: CardPayment[]
  run: (action: () => Promise<unknown>, success: string) => Promise<boolean>
}

const money = (minor: number, currency: Currency) => formatMoney(minor, currency)
const value = (data: FormData, name: string) => String(data.get(name) ?? '')

function Field({ label, name, type = 'text', defaultValue, min, step, required = false }: { label: string; name: string; type?: string; defaultValue?: string | number; min?: string; step?: string; required?: boolean }) {
  return <div className="grid gap-1"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} defaultValue={defaultValue} min={min} step={step} required={required} /></div>
}

export function CardRelationsPanel({ accounts, cards, categories, purchases, installments, statements, payments, run }: Props) {
  const [includeVoid, setIncludeVoid] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<CardPurchase>()
  const [voidingPurchase, setVoidingPurchase] = useState<CardPurchase>()
  const [editingPayment, setEditingPayment] = useState<CardPayment>()
  const [voidingPayment, setVoidingPayment] = useState<CardPayment>()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const expenseCategories = categories.filter(category => category.kind === 'expense' && !category.archived)
  const visiblePurchases = purchases.filter(item => includeVoid || item.status !== 'void')
  const visibleStatements = statements.filter(item => includeVoid || item.status !== 'void')
  const visiblePayments = payments.filter(item => includeVoid || item.status !== 'void')
  const paymentById = useMemo(() => new Map(payments.map(payment => [payment.id, payment])), [payments])
  const restoreFocus = () => triggerRef.current?.focus()
  const open = <T,>(setter: (item: T) => void, item: T, trigger: HTMLButtonElement) => { triggerRef.current = trigger; setter(item) }

  const purchaseStatementIds = (purchaseId: string) => new Set(installments.filter(item => item.purchaseId === purchaseId && item.statementId).map(item => item.statementId!))
  const purchasePayments = (purchaseId: string) => {
    const ids = purchaseStatementIds(purchaseId)
    return payments.filter(payment => ids.has(payment.statementId) && payment.status !== 'void')
  }

  const submitEditPurchase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editingPurchase) return
    const data = new FormData(event.currentTarget)
    const success = await run(() => financeService.updateCardPurchase(editingPurchase.id, { cardId: value(data, 'edit-purchase-card'), categoryId: value(data, 'edit-purchase-category') || undefined, purchaseDate: value(data, 'edit-purchase-date'), description: value(data, 'edit-purchase-description'), amount: value(data, 'edit-purchase-amount'), installmentCount: Number(value(data, 'edit-purchase-count')) }), 'Compra y cronograma actualizados.')
    if (success) setEditingPurchase(undefined)
  }
  const submitVoidPurchase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!voidingPurchase) return
    const success = await run(() => financeService.voidCardPurchase(voidingPurchase.id, value(new FormData(event.currentTarget), 'purchase-void-reason')), 'Compra anulada; consumo y obligaciones recalculados.')
    if (success) setVoidingPurchase(undefined)
  }
  const submitEditPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editingPayment) return
    const data = new FormData(event.currentTarget)
    const success = await run(() => financeService.updateCardPayment(editingPayment.id, { accountId: value(data, 'edit-payment-account'), date: value(data, 'edit-payment-date'), amount: value(data, 'edit-payment-amount') }), 'Pago actualizado y resumen recalculado.')
    if (success) setEditingPayment(undefined)
  }
  const submitVoidPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!voidingPayment) return
    const success = await run(() => financeService.voidCardPayment(voidingPayment.id, value(new FormData(event.currentTarget), 'payment-void-reason')), 'Pago anulado; saldo y resumen restaurados.')
    if (success) setVoidingPayment(undefined)
  }
  const submitPurchase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const success = await run(() => financeService.createCardPurchase({ cardId: value(data, 'purchase-card'), categoryId: value(data, 'purchase-category') || undefined, purchaseDate: value(data, 'purchase-date'), description: value(data, 'purchase-description'), amount: value(data, 'purchase-amount'), installmentCount: Number(value(data, 'purchase-count')) }), 'Compra y cuotas creadas.')
    if (success) form.reset()
  }
  const submitPayment = async (event: FormEvent<HTMLFormElement>, statementId: string) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const success = await run(() => financeService.payCard(statementId, value(data, `pay-account-${statementId}`), value(data, `pay-amount-${statementId}`), todayLocal()), 'Pago registrado.')
    if (success) form.reset()
  }

  return <Card className="self-start p-4">
    <div className="mb-3"><h2 className="text-base font-semibold leading-tight">Compras y resúmenes</h2><p className="mt-0.5 text-xs leading-snug text-muted">La compra es consumo; el pago cancela pasivo y caja.</p></div>
    {cards.length ? <form className="grid gap-2.5 min-[430px]:grid-cols-2" onSubmit={submitPurchase}>
      <FormSelect className="gap-1" label="Tarjeta" name="purchase-card" defaultValue={cards.find(card => card.active)?.id} required options={cards.filter(card => card.active).map(card => ({ value: card.id, label: card.name }))} />
      <FormSelect className="gap-1" label="Categoría" name="purchase-category" defaultValue="" options={[{ value: '', label: 'Sin categoría' }, ...expenseCategories.map(category => ({ value: category.id, label: category.name }))]} />
      <div className="min-[430px]:col-span-2"><Field label="Comercio o concepto" name="purchase-description" required /></div>
      <div className="grid gap-2.5 min-[430px]:col-span-2 min-[430px]:grid-cols-[1fr_90px_1fr]"><Field label="Importe" name="purchase-amount" type="number" min="0.01" step="0.01" required /><Field label="Cuotas" name="purchase-count" type="number" min="1" defaultValue="1" required /><DatePickerField className="gap-1" label="Fecha" name="purchase-date" defaultValue={todayLocal()} required /></div>
      <Button className="min-[430px]:col-span-2" type="submit"><CreditCardIcon aria-hidden="true" />Registrar compra</Button>
    </form> : <p className="text-sm text-muted">Creá una tarjeta para registrar compras.</p>}

    <label className="mt-3 flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={includeVoid} onChange={event => setIncludeVoid(event.target.checked)} /> Incluir anulados</label>

    <section aria-labelledby="purchase-history" className="mt-2"><h3 id="purchase-history" className="mb-1.5 font-semibold">Compras</h3><div className="grid gap-1.5">
      {visiblePurchases.length ? visiblePurchases.map(purchase => {
        const card = cards.find(item => item.id === purchase.cardId); const relatedInstallments = installments.filter(item => item.purchaseId === purchase.id)
        const activePayments = purchasePayments(purchase.id)
        return <article key={purchase.id} className="rounded-xl border border-line p-2.5 text-sm" data-status={purchase.status}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{purchase.description}</strong> <span className="text-muted">· {card?.name ?? 'Tarjeta'}</span><div className="text-muted">{money(purchase.totalMinor, purchase.currency)} · {purchase.installmentCount} cuota{purchase.installmentCount === 1 ? '' : 's'} · {purchase.purchaseDate}</div></div><span className={purchase.status === 'void' ? 'text-danger' : 'text-success'}>{purchase.status === 'void' ? 'Anulada' : 'Activa'}</span></div>
          <div className="mt-1.5 text-xs text-muted">Cuotas: {relatedInstallments.filter(item => item.status !== 'void').map(item => `${item.number}/${item.total} ${money(item.amountMinor, purchase.currency)} (${item.status})`).join(' · ') || 'sin obligaciones activas'}</div>
          {purchase.voidReason ? <div className="mt-1 text-xs text-muted">Motivo: {purchase.voidReason}</div> : null}
          {purchase.status !== 'void' ? <div className="mt-2 flex flex-wrap gap-1.5"><IconAction size="icon-sm" variant="outline" icon={Pencil} label={`Editar compra ${purchase.description}`} onClick={event => open(setEditingPurchase, purchase, event.currentTarget)} /><IconAction size="icon-sm" variant="outline" icon={Ban} label={`Anular compra ${purchase.description}`} onClick={event => open(setVoidingPurchase, purchase, event.currentTarget)} /></div> : null}
          {activePayments.length ? <div className="mt-1.5 rounded-lg bg-raised p-2 text-xs">Tiene {activePayments.length} pago{activePayments.length === 1 ? '' : 's'} activo{activePayments.length === 1 ? '' : 's'}. Revertí primero: {activePayments.map(item => money(item.amountMinor, item.currency)).join(', ')}.<Button type="button" size="xs" variant="outline" className="mt-1.5" onClick={() => { const target = document.querySelector<HTMLElement>(`#payment-${activePayments[0].id} button`); target?.scrollIntoView({ block: 'center' }); target?.focus() }}>Ir al pago</Button></div> : null}
        </article>
      }) : <p className="text-sm text-muted">Todavía no hay compras.</p>}
    </div></section>

    <section aria-labelledby="statement-history" className="mt-3"><h3 id="statement-history" className="mb-1.5 font-semibold">Resúmenes y pagos</h3><div className="grid gap-1.5">
      {visibleStatements.map(statement => { const card = cards.find(item => item.id === statement.cardId); const statementPayments = visiblePayments.filter(item => item.statementId === statement.id)
        return <article key={statement.id} className="rounded-xl border border-line p-2.5 text-sm"><div><strong>{card?.name ?? 'Tarjeta'}</strong> · vence {statement.dueDate} · <span>{statement.status === 'void' ? 'Anulado' : statement.status}</span><div className="text-muted">Total {money(statement.amountMinor, card?.currency ?? 'ARS')} · pagado {money(statement.paidMinor, card?.currency ?? 'ARS')}</div></div>
          {statement.status !== 'paid' && statement.status !== 'void' ? <form className="mt-2 grid gap-2 min-[430px]:grid-cols-2" onSubmit={event => void submitPayment(event, statement.id)}><FormSelect className="gap-1" label="Cuenta de pago" name={`pay-account-${statement.id}`} defaultValue={accounts.find(account => account.active && account.currency === card?.currency)?.id} required options={accounts.filter(account => account.active && account.currency === card?.currency).map(account => ({ value: account.id, label: account.name }))} /><Field label="Importe a pagar" name={`pay-amount-${statement.id}`} type="number" min="0.01" step="0.01" required /><Button className="min-[430px]:col-span-2" type="submit" size="sm">Registrar pago</Button></form> : null}
          {statementPayments.map(payment => <div key={payment.id} id={`payment-${payment.id}`} className="mt-2 rounded-lg bg-raised p-2.5"><div className="flex flex-wrap justify-between gap-1.5"><span>Pago {money(payment.amountMinor, payment.currency)} · {payment.date}</span><span>{payment.status === 'void' ? 'Anulado' : 'Activo'}</span></div>{payment.voidReason ? <div className="text-xs text-muted">Motivo: {payment.voidReason}</div> : null}{payment.status !== 'void' ? <div className="mt-1.5 flex flex-wrap gap-1.5"><IconAction size="icon-sm" variant="outline" icon={Pencil} label={`Editar pago de ${money(payment.amountMinor, payment.currency)}`} onClick={event => open(setEditingPayment, paymentById.get(payment.id)!, event.currentTarget)} /><IconAction size="icon-sm" variant="outline" icon={Ban} label={`Anular pago de ${money(payment.amountMinor, payment.currency)}`} onClick={event => open(setVoidingPayment, payment, event.currentTarget)} /></div> : null}</div>)}
        </article> })}
    </div></section>

    <ResponsiveModal open={Boolean(editingPurchase)} onOpenChange={isOpen => { if (!isOpen) setEditingPurchase(undefined) }} title="Editar compra" description="Se reemplazará el cronograma y se recalcularán los resúmenes." onCloseAutoFocus={restoreFocus}>
      {editingPurchase ? <form className="grid gap-3" onSubmit={submitEditPurchase}>
        <FormSelect label="Tarjeta" name="edit-purchase-card" defaultValue={editingPurchase.cardId} required options={cards.filter(card => card.active).map(card => ({ value: card.id, label: card.name }))} /><Field label="Comercio o concepto" name="edit-purchase-description" defaultValue={editingPurchase.description} required /><FormSelect label="Categoría" name="edit-purchase-category" defaultValue={editingPurchase.categoryId ?? ''} options={[{ value: '', label: 'Sin categoría' }, ...expenseCategories.map(category => ({ value: category.id, label: category.name }))]} /><div className="grid gap-3 min-[430px]:grid-cols-3"><Field label="Importe" name="edit-purchase-amount" type="number" min="0.01" step="0.01" defaultValue={editingPurchase.totalMinor / 100} required /><Field label="Cuotas" name="edit-purchase-count" type="number" min="1" defaultValue={editingPurchase.installmentCount} required /><DatePickerField label="Fecha" name="edit-purchase-date" defaultValue={editingPurchase.purchaseDate} required /></div><Button type="submit"><Save aria-hidden="true" />Guardar cambios</Button>
      </form> : null}
    </ResponsiveModal>

    <ResponsiveModal open={Boolean(voidingPurchase)} onOpenChange={isOpen => { if (!isOpen) setVoidingPurchase(undefined) }} title="Anular compra" description="La compra seguirá visible en el historial." onCloseAutoFocus={restoreFocus}>
      {voidingPurchase ? <form className="grid gap-3" onSubmit={submitVoidPurchase}><div className="rounded-xl bg-raised p-3 text-sm"><strong>Impacto</strong><ul className="mt-2 list-disc pl-5"><li>Desaparece el gasto de {money(voidingPurchase.totalMinor, voidingPurchase.currency)} de los indicadores.</li><li>Se anulan {installments.filter(item => item.purchaseId === voidingPurchase.id && item.status !== 'void').length} cuotas y se recalculan sus resúmenes.</li><li>No cambia una cuenta líquida: la compra todavía no era una salida de caja.</li></ul></div>{purchasePayments(voidingPurchase.id).length ? <div role="alert" className="rounded-xl border border-danger/50 p-3 text-sm">Primero anulá los pagos activos asociados.</div> : null}<Field label="Motivo (opcional)" name="purchase-void-reason" /><Button type="submit" variant="destructive" disabled={purchasePayments(voidingPurchase.id).length > 0}>Confirmar anulación</Button></form> : null}
    </ResponsiveModal>

    <ResponsiveModal open={Boolean(editingPayment)} onOpenChange={isOpen => { if (!isOpen) setEditingPayment(undefined) }} title="Editar pago" description="El saldo de la cuenta y el estado del resumen se recalcularán juntos." onCloseAutoFocus={restoreFocus}>
      {editingPayment ? <form className="grid gap-3" onSubmit={submitEditPayment}><FormSelect label="Cuenta de pago" name="edit-payment-account" defaultValue={editingPayment.accountId} required options={accounts.filter(account => account.active && account.currency === editingPayment.currency).map(account => ({ value: account.id, label: account.name }))} /><Field label="Importe" name="edit-payment-amount" type="number" min="0.01" step="0.01" defaultValue={editingPayment.amountMinor / 100} required /><DatePickerField label="Fecha" name="edit-payment-date" defaultValue={editingPayment.date} required /><Button type="submit"><Save aria-hidden="true" />Guardar cambios</Button></form> : null}
    </ResponsiveModal>

    <ResponsiveModal open={Boolean(voidingPayment)} onOpenChange={isOpen => { if (!isOpen) setVoidingPayment(undefined) }} title="Anular pago" description="El pago seguirá visible en el historial." onCloseAutoFocus={restoreFocus}>
      {voidingPayment ? <form className="grid gap-3" onSubmit={submitVoidPayment}><div className="rounded-xl bg-raised p-3 text-sm"><strong>Impacto</strong><p className="mt-2">Se restauran {money(voidingPayment.amountMinor, voidingPayment.currency)} en la cuenta de pago y se reabre el resumen.</p></div><Field label="Motivo (opcional)" name="payment-void-reason" /><Button type="submit" variant="destructive">Confirmar anulación</Button></form> : null}
    </ResponsiveModal>
  </Card>
}
