import { cloneElement, useState, type MouseEventHandler, type ReactElement, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'

type ConfirmationDialogProps = {
  trigger: ReactElement<{ onClick?: MouseEventHandler }>
  title: string
  description: ReactNode
  confirmLabel: string
  pendingLabel: string
  onConfirm: () => Promise<boolean | void>
  variant?: 'default' | 'destructive'
}

export function ConfirmationDialog({ trigger, title, description, confirmLabel, pendingLabel, onConfirm, variant = 'default' }: ConfirmationDialogProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const confirm = async (event: React.MouseEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const completed = await onConfirm()
      if (completed !== false) setOpen(false)
    } finally {
      setPending(false)
    }
  }

  const triggerWithClick = cloneElement(trigger, {
    onClick: event => {
      trigger.props.onClick?.(event)
      if (!event.defaultPrevented) setOpen(true)
    },
  })

  return <AlertDialog open={open} onOpenChange={next => { if (!pending) setOpen(next) }}>
    {triggerWithClick}
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
        <AlertDialogAction variant={variant} disabled={pending} aria-busy={pending} onClick={confirm}>
          {pending ? <><LoaderCircle className="animate-spin" aria-hidden="true" />{pendingLabel}</> : confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
