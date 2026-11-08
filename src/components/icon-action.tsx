import { forwardRef } from 'react'
import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type IconActionProps = Omit<React.ComponentProps<typeof Button>, 'children' | 'aria-label'> & {
  label: string
  icon: LucideIcon
  tooltipSide?: React.ComponentProps<typeof TooltipContent>['side']
  loading?: boolean
}

export const IconAction = forwardRef<HTMLButtonElement, IconActionProps>(function IconAction(
  { label, icon, size = 'icon', type = 'button', tooltipSide, loading = false, disabled, ...props },
  ref,
) {
  const Icon = loading ? LoaderCircle : icon
  return <Tooltip><TooltipTrigger asChild><Button ref={ref} type={type} size={size} aria-label={loading ? `${label}, en curso` : label} aria-busy={loading || undefined} disabled={disabled || loading} {...props}><Icon className={loading ? 'animate-spin' : undefined} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent side={tooltipSide}>{loading ? 'Procesando…' : label}</TooltipContent></Tooltip>
})
