import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileText, Loader2, Upload, WalletCards } from 'lucide-react'
import type { Account, Category, Currency } from '@/models'
import {
  classifyMercadoPagoRows, confirmMercadoPagoImport, findDuplicateExternalIds, hashFile,
  parseMercadoPagoStatement, type ClassifiedMercadoPagoRow,
} from '@/data/mercado-pago-import'
import { extractPdfText } from '@/data/pdf-text'
import { formatMoney } from '@/domain/money'
import { ResponsiveModal } from '@/components/responsive-modal'
import { SelectField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { m } from 'motion/react'

function LoadingIcon() {
  return <m.span className="inline-flex" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}><Loader2 aria-hidden="true" /></m.span>
}

type ReviewRow = ClassifiedMercadoPagoRow & {
  decision: 'expense' | 'exclude' | null
  categoryId: string
  duplicate: boolean
}

type Props = {
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onImported: (period: { start: string; end: string }) => Promise<void>
}

const money = (minor: number, currency: Currency) => formatMoney(Math.abs(minor), currency)

const periodLabel = (start: string, end: string) => `${start.slice(8, 10)}/${start.slice(5, 7)}/${start.slice(0, 4)} al ${end.slice(8, 10)}/${end.slice(5, 7)}/${end.slice(0, 4)}`

export function MercadoPagoImportModal({ accounts, categories, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('')
  const fileHashRef = useRef('')
  const [period, setPeriod] = useState({ start: '', end: '' })
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [accountsByCurrency, setAccountsByCurrency] = useState<Partial<Record<Currency, string>>>({})
  const [result, setResult] = useState({ imported: 0, duplicates: 0 })

  const expenseCategories = useMemo(() => categories.filter(category => category.kind === 'expense' && !category.archived), [categories])
  const selectedRows = rows.filter(row => !row.duplicate && row.decision === 'expense')
  const selectedCurrencies = Array.from(new Set(selectedRows.map(row => row.currency)))
  const unresolved = rows.filter(row => !row.duplicate && row.classification === 'ambiguous-transfer' && row.decision === null).length
  const excluded = rows.filter(row => row.decision === 'exclude' || row.classification === 'excluded').length
  const duplicates = rows.filter(row => row.duplicate).length

  const updateRow = (externalId: string, currency: Currency, update: Partial<ReviewRow>) => {
    setRows(current => current.map(row => row.externalId === externalId && row.currency === currency ? { ...row, ...update } : row))
  }

  const readFile = async (file: File) => {
    setLoading(true); setError('')
    try {
      const [pages, hash] = await Promise.all([extractPdfText(file), hashFile(file)])
      const statement = parseMercadoPagoStatement(pages)
      const classified = classifyMercadoPagoRows(statement.rows, categories)
      const duplicateIds = await findDuplicateExternalIds(statement.rows)
      const nextRows = classified.map<ReviewRow>(row => ({
        ...row,
        decision: row.classification === 'expense' ? 'expense' : row.classification === 'excluded' ? 'exclude' : null,
        categoryId: row.suggestedCategoryId,
        duplicate: duplicateIds.has(`${row.currency}:${row.externalId}`),
      }))
      const initialAccounts: Partial<Record<Currency, string>> = {}
      for (const currency of ['ARS', 'USD'] as const) {
        if (nextRows.some(row => row.currency === currency && row.classification !== 'excluded')) {
          initialAccounts[currency] = accounts.find(account => account.active && account.currency === currency)?.id ?? '__create__'
        }
      }
      setFilename(file.name); fileHashRef.current = hash; setPeriod({ start: statement.periodStart, end: statement.periodEnd })
      setRows(nextRows); setAccountsByCurrency(initialAccounts); setStep('review')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos procesar el archivo.')
      if (inputRef.current) inputRef.current.value = ''
    } finally { setLoading(false) }
  }

  const confirm = async () => {
    setError('')
    if (unresolved) { setError('Decidí qué hacer con todas las transferencias enviadas antes de continuar.'); return }
    if (!selectedRows.length) { setError('Seleccioná al menos un gasto para importar.'); return }
    if (selectedRows.some(row => !row.categoryId)) { setError('Todos los gastos necesitan una categoría.'); return }
    setLoading(true)
    try {
      const response = await confirmMercadoPagoImport({
        filename, fileHash: fileHashRef.current, periodStart: period.start, periodEnd: period.end,
        selectedRows: selectedRows.map(row => ({
          date: row.date, description: row.description, externalId: row.externalId, amountMinor: row.amountMinor,
          currency: row.currency, categoryId: row.categoryId,
        })),
        excludedCount: excluded, duplicateCount: duplicates,
        accountsByCurrency: Object.fromEntries(selectedCurrencies.map(currency => [currency, accountsByCurrency[currency] === '__create__'
          ? { create: true }
          : { create: false, accountId: accountsByCurrency[currency] }])) as Partial<Record<Currency, { create: boolean; accountId?: string }>>,
      })
      await onImported(period)
      setResult({ imported: response.importedCount, duplicates: response.duplicateCount }); setStep('done')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar los movimientos.')
    } finally { setLoading(false) }
  }

  return <ResponsiveModal open size={step === 'review' ? 'wide' : 'default'} onOpenChange={open => { if (!open && !loading) onClose() }} title="Importar resumen de Mercado Pago" description="El PDF se procesa en este dispositivo y nunca se sube a un servidor.">
    {step === 'upload' && <div className="grid gap-4">
      <Card className="grid min-h-[220px] place-items-center border-dashed p-6 text-center">
        <div><div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[rgba(197,242,119,0.08)] text-accent"><FileText aria-hidden="true" /></div>
          <h3 className="mb-2 text-base">Elegí el resumen de un mes cerrado</h3>
          <p className="mx-auto max-w-sm text-xs leading-5 text-muted">Vamos a leer fecha, comercio, ID e importe. Los saldos de Mercado Pago se ignoran.</p>
          <input ref={inputRef} aria-label="Resumen de Mercado Pago en PDF" className="sr-only" id="mercado-pago-pdf" type="file" accept="application/pdf,.pdf" disabled={loading} onChange={event => { const file = event.target.files?.[0]; if (file) void readFile(file) }} />
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={loading}>{loading ? <LoadingIcon /> : <Upload aria-hidden="true" />}{loading ? 'Leyendo resumen…' : 'Seleccionar PDF'}</Button>
        </div>
      </Card>
      {error && <p role="alert" className="m-0 rounded-xl bg-[rgba(240,139,136,0.1)] p-3 text-sm text-danger">{error}</p>}
    </div>}

    {step === 'review' && <div className="grid min-h-0 gap-4">
      <div className="grid gap-3 rounded-2xl bg-raised p-4 text-xs tablet:grid-cols-[minmax(0,1fr)_auto] tablet:items-center"><span className="min-w-0"><strong className="block truncate text-sm">{filename}</strong><span className="mt-1 block text-muted">{periodLabel(period.start, period.end)}</span></span><span className="whitespace-nowrap font-medium">{selectedRows.length} gastos seleccionados · {duplicates} duplicados</span></div>

      <div className="grid gap-3 tablet:grid-cols-2">{selectedCurrencies.map(currency => <SelectField key={currency} label={`Cuenta para gastos en ${currency}`} name={`mp-account-${currency}`} value={accountsByCurrency[currency] ?? ''} onValueChange={value => setAccountsByCurrency(current => ({ ...current, [currency]: value }))} options={[
        ...accounts.filter(account => account.active && account.currency === currency).map(account => ({ value: account.id, label: account.name })),
        { value: '__create__', label: `Crear Mercado Pago (${currency}) con saldo $0` },
      ]} />)}</div>

      {unresolved > 0 && <p role="status" className="m-0 rounded-xl border border-[rgba(229,183,105,0.18)] bg-[rgba(229,183,105,0.1)] p-3 text-xs text-[#e5b769]">Quedan {unresolved} transferencias por revisar.</p>}
      <div className="flex max-h-[24vh] min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain pr-2 tablet:max-h-[48vh]" aria-label="Movimientos detectados">
        {rows.filter(row => row.classification !== 'excluded').map(row => <Card className={`shrink-0 gap-3 rounded-2xl p-4 shadow-none ${row.classification === 'ambiguous-transfer' && row.decision === null ? 'border-[rgba(229,183,105,0.35)]' : ''} ${row.duplicate ? 'opacity-60' : ''}`} key={`${row.currency}:${row.externalId}`}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4"><div className="min-w-0"><strong className="block text-sm leading-5">{row.description}</strong><span className="mt-0.5 block text-[11px] text-muted">{row.date.split('-').reverse().join('/')} · Operación {row.externalId}</span></div><strong className="whitespace-nowrap pt-0.5 text-sm text-danger">−{money(row.amountMinor, row.currency)}</strong></div>
          {row.duplicate ? <span className="text-xs text-muted">Ya importado; se omitirá.</span> : <>
            {row.classification === 'ambiguous-transfer' && <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3"><legend className="float-left mr-5 text-xs font-medium">¿Fue un gasto?</legend>
              <label className="flex min-h-8 items-center gap-2 text-xs"><input className="size-4 accent-[#c5f277]" type="radio" name={`decision-${row.currency}-${row.externalId}`} checked={row.decision === 'expense'} onChange={() => updateRow(row.externalId, row.currency, { decision: 'expense' })} /> Sí, importar</label>
              <label className="flex min-h-8 items-center gap-2 text-xs"><input className="size-4 accent-[#c5f277]" type="radio" name={`decision-${row.currency}-${row.externalId}`} checked={row.decision === 'exclude'} onChange={() => updateRow(row.externalId, row.currency, { decision: 'exclude' })} /> No, excluir</label>
            </fieldset>}
            {row.decision === 'expense' && <div className="grid items-end gap-3 border-t border-line pt-3 tablet:grid-cols-[minmax(220px,1fr)_auto]"><SelectField label="Categoría" name={`category-${row.currency}-${row.externalId}`} value={row.categoryId} onValueChange={value => updateRow(row.externalId, row.currency, { categoryId: value })} options={expenseCategories.map(category => ({ value: category.id, label: category.name }))} />
              {row.classification === 'expense' && <label className="flex min-h-10 items-center gap-2 pb-1 text-xs"><input className="size-4 accent-[#c5f277]" type="checkbox" checked={row.decision === 'expense'} onChange={event => updateRow(row.externalId, row.currency, { decision: event.target.checked ? 'expense' : 'exclude' })} /> Incluir</label>}
            </div>}
          </>}
        </Card>)}
      </div>
      {error && <p role="alert" className="m-0 rounded-xl bg-[rgba(240,139,136,0.1)] p-3 text-sm text-danger">{error}</p>}
      <div className="grid grid-cols-[minmax(110px,1fr)_minmax(0,2fr)] gap-2 border-t border-line pt-4"><Button type="button" variant="outline" disabled={loading} onClick={() => { setStep('upload'); setError('') }}>Atrás</Button><Button type="button" disabled={loading || unresolved > 0 || !selectedRows.length} onClick={() => void confirm()}>{loading ? <LoadingIcon /> : <WalletCards aria-hidden="true" />}{loading ? 'Importando…' : `Importar ${selectedRows.length} gastos`}</Button></div>
    </div>}

    {step === 'done' && <div className="grid place-items-center gap-4 py-8 text-center" role="status"><div className="grid size-16 place-items-center rounded-full bg-[rgba(130,209,162,0.12)] text-success"><CheckCircle2 size={32} aria-hidden="true" /></div><div><h3 className="mb-2 text-xl">Importación terminada</h3><p className="text-sm text-muted">Se agregaron {result.imported} gastos.{result.duplicates ? ` Omitimos ${result.duplicates} duplicados.` : ''}</p></div><Button type="button" onClick={onClose}>Ver movimientos</Button></div>}
  </ResponsiveModal>
}

