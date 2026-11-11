// react-doctor-disable-next-line prefer-dynamic-import -- App.tsx loads this chart-only module with React.lazy.
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

type ChartDatum = {
  name: string
  value: number
  color: string
}

type FinanceChartProps = {
  data: ChartDatum[]
  formatValue: (value: number) => string
  kind: 'bar' | 'pie'
  totalLabel?: string
}

export default function FinanceChart({ data, formatValue, kind, totalLabel }: FinanceChartProps) {
  const config = data.reduce<ChartConfig>((result, item) => {
    result[item.name] = { label: item.name, color: item.color }
    return result
  }, {})

  const tooltip = <ChartTooltipContent
    hideLabel
    formatter={(value, _name, item) => <div className="flex min-w-36 items-center justify-between gap-4"><span className="text-muted">{item.payload.name}</span><strong>{formatValue(Number(value))}</strong></div>}
  />

  if (kind === 'bar') {
    const chartHeight = Math.max(230, data.length * 30)
    return (
      <ChartContainer config={config} className="w-full aspect-auto" style={{ height: chartHeight }}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 14 }}>
          <CartesianGrid stroke="rgba(245,247,242,.05)" horizontal={false} />
          <XAxis hide type="number" />
          <YAxis type="category" dataKey="name" width={108} interval={0} tick={{ fill: '#AAB3B1', fontSize: 11 }} axisLine={false} tickLine={false} />
          <ChartTooltip content={tooltip} isAnimationActive={false} animationDuration={0} />
          <Bar dataKey="value" radius={[0, 7, 7, 0]} isAnimationActive={false}>
            {data.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Bar>
        </BarChart>
      </ChartContainer>
    )
  }

  return <div className="relative h-[220px] w-full">
    <ChartContainer config={config} className="h-full w-full aspect-auto">
      <PieChart>
        <Pie data={data} dataKey="value" innerRadius={62} outerRadius={94} paddingAngle={3} isAnimationActive={false}>
          {data.map((item) => <Cell key={item.name} fill={item.color} />)}
        </Pie>
        <ChartTooltip content={tooltip} isAnimationActive={false} animationDuration={0} />
      </PieChart>
    </ChartContainer>
    {totalLabel ? <div className="pointer-events-none absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center text-center" aria-label={`Total ${totalLabel}`}>
      <span className="text-[11px] text-muted">Total</span>
      <strong className="max-w-[112px] text-sm font-bold leading-tight tabular-nums text-text">{totalLabel}</strong>
    </div> : null}
  </div>
}
