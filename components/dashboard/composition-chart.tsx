"use client"

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { ChemicalAbundance } from "@/lib/demo-data"

const chartConfig: ChartConfig = {
  abundance: {
    label: "log10 mixing ratio",
    color: "var(--chart-1)",
  },
}

export function CompositionChart({ data }: { data: ChemicalAbundance[] }) {
  const chartData = [...data].sort((a, b) => b.abundance - a.abundance)

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 0, left: 0 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis type="number" domain={[-7, -2]} hide />
          <YAxis
            type="category"
            dataKey="formula"
            tickLine={false}
            axisLine={false}
            width={56}
            fontSize={12}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => payload?.[0]?.payload?.molecule}
              />
            }
          />
          <Bar dataKey="abundance" fill="var(--color-abundance)" radius={3} barSize={16}>
            <LabelList
              dataKey="confidence"
              position="right"
              formatter={(v: number) => `${Math.round(v * 100)}% conf.`}
              fontSize={11}
              fill="var(--muted-foreground)"
            />
          </Bar>
        </BarChart>
      </ChartContainer>

      <ul className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
        {chartData.map((c) => (
          <li key={c.formula} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{c.molecule}</span>
            <span className="font-mono text-foreground">{c.abundance.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
