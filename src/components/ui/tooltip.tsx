import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { m } from "motion/react"
import { motionTransition } from "@/components/motion-variants"

function TooltipProvider({ delayDuration = 300, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger(props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({ className, sideOffset = 6, children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return <TooltipPrimitive.Portal><TooltipPrimitive.Content asChild
    data-slot="tooltip-content"
    sideOffset={sideOffset}
    className={cn("z-50 max-w-64", className)}
    {...props}
  ><m.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={motionTransition.quick} className="rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xl">{children}<TooltipPrimitive.Arrow className="fill-raised" /></m.div></TooltipPrimitive.Content></TooltipPrimitive.Portal>
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
