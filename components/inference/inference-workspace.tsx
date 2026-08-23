"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Cpu, Zap, ArrowRight, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { modelArchitectures, demoObservations } from "@/lib/demo-data"

type RunState = "idle" | "running" | "complete"

const STAGES = [
  "Loading observation cadence",
  "Normalizing flux baseline",
  "Running denoising forward pass",
  "Sampling posterior uncertainty",
  "Finalizing recovered spectrum",
]

export function InferenceWorkspace() {
  const router = useRouter()
  const [modelId, setModelId] = useState(modelArchitectures[0].id)
  const [runState, setRunState] = useState<RunState>("idle")
  const [progress, setProgress] = useState(0)
  const [stageIndex, setStageIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedModel = modelArchitectures.find((m) => m.id === modelId) ?? modelArchitectures[0]

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const startRun = useCallback(() => {
    setRunState("running")
    setProgress(0)
    setStageIndex(0)

    const totalDuration = 4200
    const tickMs = 90
    let elapsed = 0

    intervalRef.current = setInterval(() => {
      elapsed += tickMs
      const pct = Math.min(100, Math.round((elapsed / totalDuration) * 100))
      setProgress(pct)
      setStageIndex(Math.min(STAGES.length - 1, Math.floor((pct / 100) * STAGES.length)))

      if (pct >= 100) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setRunState("complete")
      }
    }, tickMs)
  }, [])

  const loadDemo = useCallback(() => {
    router.push("/results")
  }, [router])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Model architecture
          </CardTitle>
          <CardDescription>Choose the recovery model to run against your observation</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {modelArchitectures.map((model) => {
            const active = model.id === modelId
            return (
              <button
                key={model.id}
                type="button"
                disabled={runState === "running"}
                onClick={() => setModelId(model.id)}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border border-border/60 bg-secondary/20 px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-60",
                  active && "border-primary/60 bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="size-4 text-primary" strokeWidth={1.75} />
                    <span className="text-sm font-medium text-foreground">{model.name}</span>
                  </div>
                  {active && <CheckCircle2 className="size-4 text-primary" strokeWidth={1.75} />}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{model.description}</p>
                <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                  <span>{model.latency}</span>
                  <span className="text-border">·</span>
                  <span>{model.accuracy}</span>
                </div>
              </button>
            )
          })}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Run inference
          </CardTitle>
          <CardDescription>
            {demoObservations[0].name} · {selectedModel.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {runState === "idle" && (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Run live inference against the currently loaded observation, or skip
                straight to precomputed demo results to explore the analysis workspace.
              </p>
              <div className="flex flex-col gap-2.5">
                <Button onClick={startRun}>
                  <Zap data-icon="inline-start" />
                  Run live inference
                </Button>
                <Button variant="outline" onClick={loadDemo}>
                  Load precomputed demo results
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </>
          )}

          {runState === "running" && (
            <>
              <div className="flex items-center gap-2.5">
                <Loader2 className="size-4 animate-spin text-primary" strokeWidth={2} />
                <span className="text-sm text-foreground">{STAGES[stageIndex]}</span>
              </div>
              <Progress value={progress} />
              <span className="font-mono text-xs text-muted-foreground">{progress}% complete</span>
            </>
          )}

          {runState === "complete" && (
            <>
              <div className="flex items-center gap-2.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
                <CheckCircle2 className="size-4 text-primary" strokeWidth={1.75} />
                <span className="text-sm text-foreground">Inference complete</span>
                <Badge variant="secondary" className="ml-auto font-mono text-[10px]">
                  {selectedModel.accuracy}
                </Badge>
              </div>
              <Button onClick={() => router.push("/results")}>
                View results
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button variant="ghost" onClick={startRun}>
                Run again
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
