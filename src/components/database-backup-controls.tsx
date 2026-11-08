import { useRef, useState } from 'react'
import { DatabaseBackup, Download, LoaderCircle, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { backupFilename, createDatabaseBackup, db, parseDatabaseBackup, restoreDatabaseBackup, validateDatabaseBackup, type BackupSummary, type DatabaseBackup as DatabaseBackupFile } from '@/data'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog'
import { Button } from './ui/button'
import { Card } from './ui/card'

type ImportProps = {
  onRestored: () => Promise<void>
  className?: string
  label?: string
}

export function DatabaseImportButton({ onRestored, className, label = 'Importar respaldo' }: ImportProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [candidate, setCandidate] = useState<{ backup: DatabaseBackupFile; summary: BackupSummary; filename: string } | null>(null)
  const [restoring, setRestoring] = useState(false)

  const selectFile = async (file?: File) => {
    if (!file) return
    try {
      const backup = parseDatabaseBackup(await file.text())
      const summary = validateDatabaseBackup(db, backup)
      setCandidate({ backup, summary, filename: file.name })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos leer el respaldo.')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const restore = async () => {
    if (!candidate || restoring) return
    setRestoring(true)
    const toastId = toast.loading('Restaurando respaldo…')
    try {
      await restoreDatabaseBackup(db, candidate.backup)
      await onRestored()
      toast.success('Respaldo restaurado.', { id: toastId })
      setCandidate(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos restaurar el respaldo.', { id: toastId })
    } finally {
      setRestoring(false)
    }
  }

  return <>
    <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" aria-label="Seleccionar archivo de respaldo" onChange={event => void selectFile(event.target.files?.[0])} />
    <Button type="button" variant="outline" className={className} onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" />{label}</Button>
    <AlertDialog open={candidate !== null} onOpenChange={open => { if (!open && !restoring) setCandidate(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>¿Reemplazar todos los datos?</AlertDialogTitle><AlertDialogDescription>El respaldo <strong>{candidate?.filename}</strong> contiene {candidate?.summary.recordCount ?? 0} registros en {candidate?.summary.tableCount ?? 0} tablas. Fue creado el {candidate ? new Date(candidate.summary.exportedAt).toLocaleString('es-AR') : ''}. Los datos actuales de este navegador serán reemplazados.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={restoring}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={restoring} onClick={event => { event.preventDefault(); void restore() }}>{restoring ? <><LoaderCircle className="animate-spin" />Restaurando…</> : 'Restaurar respaldo'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}

export function DatabaseBackupCard({ onRestored }: { onRestored: () => Promise<void> }) {
  const [exporting, setExporting] = useState(false)
  const exportBackup = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const backup = await createDatabaseBackup(db)
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = backupFilename()
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Respaldo exportado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos exportar el respaldo.')
    } finally {
      setExporting(false)
    }
  }

  return <Card className="self-start p-4"><div className="mb-3 flex items-start gap-2.5"><div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-accent"><DatabaseBackup size={16} aria-hidden="true" /></div><div><h2 className="text-base leading-tight">Respaldo de datos</h2><p className="mt-0.5 text-xs leading-snug text-muted">Llevá toda tu información a otro navegador o computadora.</p></div></div>
    <p className="mb-3 text-sm text-muted">La exportación incluye cuentas, movimientos, categorías, tarjetas, configuraciones y todos sus datos relacionados.</p>
    <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => void exportBackup()} disabled={exporting}>{exporting ? <><LoaderCircle className="animate-spin" />Exportando…</> : <><Download aria-hidden="true" />Exportar respaldo</>}</Button><DatabaseImportButton onRestored={onRestored} /></div>
  </Card>
}
