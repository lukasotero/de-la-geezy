import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, getDefaultClassNames, type DayButton, type Locale } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-variants"

function Calendar({ className, classNames, showOutsideDays = true, captionLayout = "label", buttonVariant = "ghost", locale, formatters, components, ...props }: React.ComponentProps<typeof DayPicker> & { buttonVariant?: React.ComponentProps<typeof Button>["variant"] }) {
  const defaults = getDefaultClassNames()
  return <DayPicker
    showOutsideDays={showOutsideDays}
    className={cn("group/calendar bg-background p-3 [--cell-radius:10px] [--cell-size:2.25rem]", className)}
    captionLayout={captionLayout}
    locale={locale}
    formatters={{ formatMonthDropdown: date => date.toLocaleString(locale?.code, { month: "short" }), ...formatters }}
    classNames={{
      root: cn("w-fit", defaults.root), months: cn("relative flex flex-col gap-4", defaults.months), month: cn("flex w-full flex-col gap-4", defaults.month),
      nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between", defaults.nav),
      button_previous: cn(buttonVariants({ variant: buttonVariant }), "size-(--cell-size) p-0", defaults.button_previous),
      button_next: cn(buttonVariants({ variant: buttonVariant }), "size-(--cell-size) p-0", defaults.button_next),
      month_caption: cn("flex h-(--cell-size) items-center justify-center px-(--cell-size)", defaults.month_caption),
      caption_label: cn("text-sm font-semibold capitalize", defaults.caption_label),
      month_grid: cn("w-full border-collapse", defaults.month_grid), weekdays: cn("flex", defaults.weekdays),
      weekday: cn("flex-1 text-center text-xs font-normal text-muted", defaults.weekday), week: cn("mt-1 flex w-full", defaults.week),
      day: cn("group/day relative aspect-square size-(--cell-size) p-0 text-center", defaults.day),
      today: cn("rounded-(--cell-radius) bg-raised text-foreground", defaults.today), outside: cn("text-muted opacity-45", defaults.outside),
      disabled: cn("text-muted opacity-40", defaults.disabled), hidden: cn("invisible", defaults.hidden), ...classNames,
    }}
    components={{
      Chevron: ({ className, orientation, ...iconProps }) => orientation === "left" ? <ChevronLeft className={cn("size-4", className)} {...iconProps} /> : orientation === "right" ? <ChevronRight className={cn("size-4", className)} {...iconProps} /> : <ChevronDown className={cn("size-4", className)} {...iconProps} />,
      DayButton: dayProps => <CalendarDayButton locale={locale} {...dayProps} />,
      ...components,
    }}
    {...props}
  />
}

function CalendarDayButton({ className, day, modifiers, locale, ...props }: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => { if (modifiers.focused) ref.current?.focus() }, [modifiers.focused])
  return <Button ref={ref} variant="ghost" size="icon" data-day={day.date.toLocaleDateString(locale?.code)} data-selected={modifiers.selected} className={cn("size-(--cell-size) min-h-0 rounded-(--cell-radius) border-0 p-0 font-normal data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground", className)} {...props} />
}

export { Calendar }
