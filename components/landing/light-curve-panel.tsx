"use client"

import { useEffect, useRef } from "react"

export type TransitPhase = {
  x: number
  inTransit: boolean
  depth: number
}

const HISTORY_LENGTH = 180

/**
 * Renders a live "light curve" — the classic dip-in-brightness readout used
 * to detect and characterize transits — driven directly from the 3D scene's
 * transit phase ref. Drawing is imperative (canvas 2D) so it stays smooth at
 * 60fps without triggering React re-renders.
 */
export function LightCurvePanel({
  phase,
}: {
  phase: React.MutableRefObject<TransitPhase>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<number[]>(new Array(HISTORY_LENGTH).fill(1))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }

    resize()
    window.addEventListener("resize", resize)

    function draw() {
      if (!canvas || !ctx) return
      const width = canvas.width
      const height = canvas.height

      const history = historyRef.current
      const brightness = phase.current.inTransit ? 1 - phase.current.depth * 0.32 : 1
      history.push(brightness)
      if (history.length > HISTORY_LENGTH) history.shift()

      ctx.clearRect(0, 0, width, height)

      // Baseline grid
      ctx.strokeStyle = "rgba(255,255,255,0.06)"
      ctx.lineWidth = 1
      for (let i = 1; i < 4; i++) {
        const y = (height / 4) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      const min = 0.6
      const max = 1.02
      const toY = (v: number) => height - ((v - min) / (max - min)) * height

      ctx.beginPath()
      ctx.strokeStyle = "#5fd3e6"
      ctx.lineWidth = 2 * dpr
      history.forEach((v, i) => {
        const x = (i / (HISTORY_LENGTH - 1)) * width
        const y = toY(v)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // Glow fill under the line
      ctx.lineTo(width, height)
      ctx.lineTo(0, height)
      ctx.closePath()
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, "rgba(95,211,230,0.22)")
      gradient.addColorStop(1, "rgba(95,211,230,0)")
      ctx.fillStyle = gradient
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [phase])

  return (
    <div className="pointer-events-auto ml-auto w-full max-w-xs rounded-md border border-border/60 bg-background/70 p-3 backdrop-blur-md">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          Relative flux
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-primary uppercase">
          <span className="size-1.5 rounded-full bg-primary shadow-[0_0_6px_1px_var(--color-primary)]" />
          live
        </span>
      </div>
      <canvas ref={canvasRef} className="h-16 w-full" />
    </div>
  )
}
