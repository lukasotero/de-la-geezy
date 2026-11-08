import { cn } from "@/lib/utils"
import { m } from "motion/react"

function Skeleton({ className, ...props }: React.ComponentProps<typeof m.div>) {
  return (
    <m.div
      data-slot="skeleton"
      className={cn("rounded-md bg-muted", className)}
      animate={{ opacity: [0.45, 0.9, 0.45] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      {...props}
    />
  )
}

export { Skeleton }
