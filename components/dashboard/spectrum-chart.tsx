"use client"

import {
  Area,
  ComposedChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { SpectrumPoint } from "@/lib/demo-data"

const chartConfig: ChartConfig = {
  observed: {
    label: "Observed",
    color: "var(--chart-2)",
  },
  recovered: {
    label: "Recovered",
    color: "var(--chart-1)",
  },
  upper: {
    label: "Uncertainty band",
    color: "var(--chart-1)",
  },
}

export function SpectrumChart({
  data,
  onPointHover,
}: {
  data: SpectrumPoint[]
  onPointHover?: (wavelength: number | null) => void
}) {
  const chartData = data.map((point) => ({
    ...point,
    bandWidth: Number((point.upper - point.lower).toFixed(1)),
  }))

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
      <ComposedChart
        data={chartData}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        onMouseMove={(state) => {
          const wl = state?.activePayload?.[0]?.payload?.wavelength
          if (typeof wl === "number") onPointHover?.(wl)
        }}
        onMouseLeave={() => onPointHover?.(null)}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
        <XAxis
          dataKey="wavelength"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v) => `${v}µm`}
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={54}
          tickFormatter={(v) => `${v}`}
          fontSize={11}
          label={{
            value: "Transit depth (ppm)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 11, fill: "var(--muted-foreground)" },
          }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => `${payload?.[0]?.payload?.wavelength} µm`}
            />
          }
        />
        <Area
          dataKey="lower"
          stackId="band"
          stroke="none"
          fill="transparent"
          isAnimationActive={false}
          legendType="none"
          tooltipType="none"
        />
        <Area
          dataKey="bandWidth"
          name="Uncertainty band"
          stackId="band"
          stroke="none"
          fill="var(--color-upper)"
          fillOpacity={0.14}
          isAnimationActive={false}
          tooltipType="none"
        />
        <Line
          dataKey="observed"
          name="Observed"
          stroke="var(--color-observed)"
          strokeWidth={1.25}
          strokeOpacity={0.55}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="recovered"
          name="Recovered"
          stroke="var(--color-recovered)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
