import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMediaQuery } from '@/hooks/use-media-query'

type ResponsiveModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  size?: 'default' | 'wide'
  onCloseAutoFocus?: () => void
}

export function ResponsiveModal({ open, onOpenChange, title, description, children, size = 'default', onCloseAutoFocus }: ResponsiveModalProps) {
  const desktop = useMediaQuery('(min-width: 760px)')
  const restoreFocus = (event: Event) => {
    if (!onCloseAutoFocus) return
    event.preventDefault()
    onCloseAutoFocus()
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent open={open} presentation={desktop ? 'dialog' : 'sheet'} onCloseAutoFocus={restoreFocus} className={`${desktop ? `max-h-[min(94dvh,900px)] rounded-[26px] ${size === 'wide' ? 'max-w-[860px] sm:max-w-[860px]' : 'max-w-[600px] sm:max-w-[600px]'}` : 'inset-x-0 bottom-0 top-auto max-h-[94dvh] max-w-none translate-x-0 translate-y-0 rounded-t-[26px] px-[18px] pb-[calc(22px+env(safe-area-inset-bottom))]'} overflow-y-auto overscroll-contain border-line bg-[#1b2023] p-[18px] shadow-2xl`}>
      <DialogHeader className="pr-10">
        <DialogTitle className="text-xl tracking-[-0.03em]">{title}</DialogTitle>
        {description && <DialogDescription className="text-xs text-muted">{description}</DialogDescription>}
      </DialogHeader>
      <div className="min-h-0">{children}</div>
    </DialogContent>
  </Dialog>
}
