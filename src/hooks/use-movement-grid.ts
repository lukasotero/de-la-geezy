import { useCallback, useEffect, useState } from 'react'
import { gridColumnsForWidth, pageSizeForColumns } from '@/domain/movement-filter'

export function useMovementGrid() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => setElement(node), [])
  const [columnCount, setColumnCount] = useState(1)

  useEffect(() => {
    if (!element) return

    const update = (width: number) => setColumnCount(current => {
      const next = gridColumnsForWidth(width)
      return next === current ? current : next
    })
    update(element.getBoundingClientRect().width)

    const observer = new ResizeObserver(entries => update(entries[0]?.contentRect.width ?? element.getBoundingClientRect().width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return { containerRef, columnCount, pageSize: pageSizeForColumns(columnCount) }
}
