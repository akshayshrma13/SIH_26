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

  // The axis range follows the data instead of being fixed: the model can
  // return abundances well outside the -7..-2 range the demo data used, and a
  // fixed domain would clip those bars.
  const values = chartData.flatMap((c) => [c.abundance, c.lower ?? c.abundance, c.upper ?? c.abundance])
  const domain: [number, number] =
    values.length > 0
      ? [Math.floor(Math.min(...values)) - 0.5, Math.ceil(Math.max(...values)) + 0.5]
      : [-7, -2]

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 0, left: 0 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis type="number" domain={domain} hide />
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
              formatter={(v: unknown) => `${Math.round(Number(v) * 100)}% conf.`}
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
            <span className="font-mono text-foreground">
              {c.abundance.toFixed(2)}
              {c.lower !== undefined && c.upper !== undefined && (
                <span className="ml-1.5 text-muted-foreground">
                  ±{((c.upper - c.lower) / 2).toFixed(2)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
