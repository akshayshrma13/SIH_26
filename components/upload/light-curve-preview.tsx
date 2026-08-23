"use client"

import { useMemo } from "react"
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts"

function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

export function LightCurvePreview({ seed = 42 }: { seed?: number }) {
  const data = useMemo(() => {
    const rand = seededRandom(seed)
    const points: { t: number; flux: number }[] = []
    const transitStart = 60
    const transitEnd = 100
    for (let i = 0; i < 160; i++) {
      let flux = 1 + (rand() - 0.5) * 0.004
      if (i >= transitStart && i <= transitEnd) {
        const mid = (transitStart + transitEnd) / 2
        const width = (transitEnd - transitStart) / 2
        const depth = 0.012 * (1 - Math.pow((i - mid) / width, 2))
        flux -= Math.max(depth, 0)
      }
      points.push({ t: i, flux: Number(flux.toFixed(5)) })
    }
    return points
  }, [seed])

  return (
    <div className="h-24 w-full rounded-md border border-border/60 bg-secondary/20 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Line
            type="monotone"
            dataKey="flux"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
