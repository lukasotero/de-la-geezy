// react-doctor-disable-next-line prefer-dynamic-import -- App.tsx loads this chart-only module with React.lazy.
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from 'recharts'
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
    return (
      <ChartContainer config={config} className="h-[230px] w-full aspect-auto">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 14 }}>
          <CartesianGrid stroke="rgba(245,247,242,.05)" horizontal={false} />
          <XAxis hide type="number" />
          <YAxis type="category" dataKey="name" width={108} tick={{ fill: '#AAB3B1', fontSize: 11 }} axisLine={false} tickLine={false} />
          <ChartTooltip content={tooltip} isAnimationActive={false} animationDuration={0} />
          <Bar dataKey="value" radius={[0, 7, 7, 0]} isAnimationActive={false}>
            {data.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Bar>
        </BarChart>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer config={config} className="h-[220px] w-full aspect-auto">
      <PieChart>
        <Pie data={data} dataKey="value" innerRadius={62} outerRadius={94} paddingAngle={3} isAnimationActive={false}>
          {data.map((item) => <Cell key={item.name} fill={item.color} />)}
          {totalLabel ? <Label
            position="center"
            content={({ viewBox }) => {
              if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null
              return <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                <tspan x={viewBox.cx} dy="-0.55em" className="fill-muted text-[11px]">Total</tspan>
                <tspan x={viewBox.cx} dy="1.5em" className="fill-text text-sm font-bold tabular-nums">{totalLabel}</tspan>
              </text>
            }}
          /> : null}
        </Pie>
        <ChartTooltip content={tooltip} isAnimationActive={false} animationDuration={0} />
      </PieChart>
    </ChartContainer>
  )
}
