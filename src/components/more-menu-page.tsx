import { ChevronRight, FolderTree, TrendingUp, Wrench } from 'lucide-react'
import type { View } from './app-shell'
import { Button } from './ui/button'
import { Card } from './ui/card'

const entries: { view: View; title: string; copy: string; icon: typeof FolderTree }[] = [
  { view: 'analysis', title: 'Análisis', copy: 'Entendé tus gastos, ingresos y tendencias.', icon: TrendingUp },
  { view: 'categories', title: 'Categorías', copy: 'Organizá ingresos y gastos en jerarquías.', icon: FolderTree },
  { view: 'tools', title: 'Herramientas', copy: 'Respaldos, recurrentes, tarjetas, deudas y cotización.', icon: Wrench },
]

export function MoreMenuPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  return <div><div className="mb-6"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">MÁS OPCIONES</div><h1 className="mb-[10px] text-[clamp(30px,7vw,52px)] leading-none tracking-[-0.05em]">Más</h1><p className="text-sm text-muted">Organización, análisis y configuración.</p></div>
    <div className="grid gap-3 tablet:grid-cols-2">{entries.map(entry => <Card key={entry.view} className="p-2"><Button type="button" variant="ghost" className="h-auto min-h-20 w-full justify-start gap-3 px-3 py-3 text-left" onClick={() => onNavigate(entry.view)}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-accent"><entry.icon size={19} aria-hidden="true" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-text">{entry.title}</strong><span className="mt-0.5 block whitespace-normal text-xs font-normal leading-snug text-muted">{entry.copy}</span></span><ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" /></Button></Card>)}</div>
  </div>
}
