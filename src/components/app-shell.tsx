import { useState } from 'react'
import { ArrowLeftRight, CreditCard, FolderTree, Home, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, ShieldCheck, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Brand } from '@/components/brand'
import { IconAction } from '@/components/icon-action'
import { m } from 'motion/react'
import { motionTransition } from '@/components/motion-variants'

export { Brand } from '@/components/brand'

export type View = 'dashboard' | 'movements' | 'accounts' | 'analysis' | 'categories' | 'tools' | 'more'

const nav = [
  { id: 'dashboard' as View, label: 'Inicio', icon: Home },
  { id: 'movements' as View, label: 'Movimientos', icon: ArrowLeftRight },
  { id: 'accounts' as View, label: 'Cuentas y tarjetas', mobileLabel: 'Cuentas', icon: CreditCard },
  { id: 'analysis' as View, label: 'Análisis', icon: TrendingUp },
  { id: 'categories' as View, label: 'Categorías', icon: FolderTree },
  { id: 'tools' as View, label: 'Más', icon: MoreHorizontal },
]

type AppShellProps = {
  view: View
  onNavigate: (view: View) => void
  onAdd: (trigger: HTMLElement) => void
  children: React.ReactNode
}

const desktopNavButton = 'flex min-h-11 w-full items-center gap-[11px] rounded-[13px] px-3'
const mobileNavButton = 'flex flex-col items-center justify-center gap-1 rounded-[13px] text-[10px]'

function DesktopNavItem({ item, selected, collapsed, onNavigate }: { item: (typeof nav)[number]; selected: boolean; collapsed: boolean; onNavigate: (view: View) => void }) {
  const selectedClass = selected ? 'bg-[rgba(197,242,119,0.08)] text-accent' : 'text-muted'
  if (collapsed) return <IconAction variant="ghost" icon={item.icon} label={item.label} tooltipSide="right" aria-current={selected ? 'page' : undefined} className={`${desktopNavButton} justify-center px-0 ${selectedClass}`} onClick={() => onNavigate(item.id)} />
  return <Button type="button" variant="ghost" aria-current={selected ? 'page' : undefined} className={`${desktopNavButton} justify-start ${selectedClass}`} onClick={() => onNavigate(item.id)}><item.icon aria-hidden="true" />{item.label}</Button>
}

function DesktopSidebar({ view, collapsed, onToggle, onNavigate, onAdd }: { view: View; collapsed: boolean; onToggle: () => void; onNavigate: (view: View) => void; onAdd: (trigger: HTMLElement) => void }) {
  return <aside className={`hidden desktop:sticky desktop:top-0 desktop:flex desktop:h-screen desktop:flex-col desktop:border-r desktop:border-line desktop:bg-[rgba(17,20,24,0.74)] desktop:py-[26px] ${collapsed ? 'desktop:px-[14px]' : 'desktop:px-[18px]'}`}>
    <div className={`mb-6 flex items-center ${collapsed ? 'flex-col gap-3' : 'justify-between gap-2 px-2'}`}><Brand variant={collapsed ? 'compact' : 'full'} /><IconAction variant="ghost" icon={collapsed ? PanelLeftOpen : PanelLeftClose} label={collapsed ? 'Abrir barra lateral' : 'Cerrar barra lateral'} aria-expanded={!collapsed} onClick={onToggle} /></div>
    {collapsed ? <IconAction className="mb-6 size-[54px] self-center" icon={Plus} label="Nuevo movimiento" tooltipSide="right" onClick={event => onAdd(event.currentTarget)} /> : <Button type="button" className="mb-6 w-full" onClick={event => onAdd(event.currentTarget)}><Plus aria-hidden="true" />Nuevo movimiento</Button>}
    <nav className="flex flex-col gap-[5px]" aria-label="Navegación de escritorio">{nav.map(item => <DesktopNavItem key={item.id} item={item} selected={view === item.id} collapsed={collapsed} onNavigate={onNavigate} />)}</nav>
    {collapsed ? null : <div className="mt-auto flex items-start gap-2.5 border-t border-line px-[10px] py-[14px] text-[11px] leading-relaxed text-muted">
      <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={22} />
      <div>
        <p>Datos guardados localmente en este navegador y dispositivo.</p>
        <p className="mt-1 text-[10px] opacity-70">Versión {__APP_VERSION__}</p>
      </div>
    </div>}
  </aside>
}

function MobileNavItem({ item, selected, onNavigate }: { item: (typeof nav)[number]; selected: boolean; onNavigate: (view: View) => void }) {
  return <Button type="button" variant="ghost" aria-label={item.label} aria-current={selected ? 'page' : undefined} className={`${mobileNavButton} h-auto min-h-0 px-0 ${selected ? 'bg-[rgba(197,242,119,0.07)] text-accent' : 'text-muted'}`} onClick={() => onNavigate(item.id)}><item.icon size={20} />{'mobileLabel' in item ? item.mobileLabel : item.label}</Button>
}

function MobileNavigation({ view, onNavigate, onAdd }: Pick<AppShellProps, 'view' | 'onNavigate' | 'onAdd'>) {
  const moreSelected = ['more', 'analysis', 'categories', 'tools'].includes(view)
  return <nav data-testid="mobile-navigation" className="fixed bottom-[max(10px,env(safe-area-inset-bottom))] left-[10px] right-[10px] z-30 grid h-[74px] grid-cols-5 rounded-[22px] border border-line bg-[rgba(25,30,33,0.94)] px-2 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.4)] backdrop-blur-[18px] desktop:hidden" aria-label="Navegación móvil">
    {nav.slice(0, 2).map(item => <MobileNavItem key={item.id} item={item} selected={view === item.id} onNavigate={onNavigate} />)}
    <Button type="button" className="mx-auto -mt-[18px] size-[54px] rounded-[18px] p-0 shadow-[0_8px_24px_rgba(197,242,119,0.24)]" aria-label="Nuevo movimiento" onClick={event => onAdd(event.currentTarget)}><Plus size={25} /></Button>
    <MobileNavItem item={nav[2]} selected={view === nav[2].id} onNavigate={onNavigate} />
    <Button type="button" variant="ghost" aria-current={moreSelected ? 'page' : undefined} className={`${mobileNavButton} h-auto min-h-0 px-0 ${moreSelected ? 'bg-[rgba(197,242,119,0.07)] text-accent' : 'text-muted'}`} onClick={() => onNavigate('more')}><MoreHorizontal size={20} />Más</Button>
  </nav>
}

function AppContent({ view, onAdd, children }: Pick<AppShellProps, 'view' | 'onAdd' | 'children'>) {
  return <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1500px] px-[18px] pb-[calc(8.25rem+env(safe-area-inset-bottom))] pt-5 desktop:px-[42px] desktop:pb-[70px] desktop:pt-8"><header className={`mb-[30px] flex items-center justify-between gap-3 ${view === 'dashboard' ? 'desktop:hidden' : ''}`}><div className="min-w-0 desktop:hidden"><Brand className="max-[399px]:[&>div]:hidden" /></div>{view !== 'dashboard' ? <Button type="button" aria-label="Nuevo movimiento" onClick={event => onAdd(event.currentTarget)}><Plus size={18} /><span className="max-[399px]:hidden">Nuevo movimiento</span></Button> : null}</header>{children}</main>
}

export function AppShell({ view, onNavigate, onAdd, children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  return <m.div className="min-h-screen desktop:grid" animate={{ gridTemplateColumns: sidebarCollapsed ? '82px minmax(0, 1fr)' : '238px minmax(0, 1fr)' }} transition={motionTransition.standard}>
    <m.a href="#main-content" initial={{ y: -96 }} whileFocus={{ y: 0 }} transition={motionTransition.quick} className="fixed left-3 top-3 z-[100] rounded-[13px] bg-primary px-4 py-3 font-semibold text-primary-foreground">Saltar al contenido</m.a>
    <DesktopSidebar view={view} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(collapsed => !collapsed)} onNavigate={onNavigate} onAdd={onAdd} />
    <AppContent view={view} onAdd={onAdd}>{children}</AppContent>
    <MobileNavigation view={view} onNavigate={onNavigate} onAdd={onAdd} />
  </m.div>
}
