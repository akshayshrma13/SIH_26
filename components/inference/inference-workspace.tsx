"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Cpu,
  Sigma,
  Zap,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Loader2,
  WifiOff,
  Orbit,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { modelArchitectures, demoObservations, type Observation } from "@/lib/demo-data"
import {
  fetchModels,
  fetchObservations,
  startInference,
  streamJobStatus,
  type ApiModel,
} from "@/lib/api"
import { getSelectedObservation, setSelectedObservation } from "@/lib/selection"

type RunState = "idle" | "running" | "complete" | "failed"

export function InferenceWorkspace() {
  const router = useRouter()

  const [stages, setStages] = useState<ApiModel[]>(modelArchitectures)
  const [observations, setObservations] = useState<Observation[]>(demoObservations)
  const [observationId, setObservationId] = useState(demoObservations[0].id)

  const [runState, setRunState] = useState<RunState>("idle")
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  // Holds the "close this SSE stream" function so we can hang up on unmount.
  const closeStreamRef = useRef<(() => void) | null>(null)

  const selectedObservation =
    observations.find((o) => o.id === observationId) ?? observations[0]

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      fetchModels(controller.signal),
      fetchObservations(controller.signal),
    ])
      .then(([stageList, observationList]) => {
        if (stageList.length > 0) setStages(stageList)
        if (observationList.length > 0) {
          setObservations(observationList)
          const remembered = getSelectedObservation()
          setObservationId(
            remembered && observationList.some((o) => o.id === remembered)
              ? remembered
              : observationList[0].id,
          )
        }
        setOffline(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setOffline(true)
      })

    return () => controller.abort()
  }, [])

  // Always close the stream when this component goes away.
  useEffect(() => {
    return () => closeStreamRef.current?.()
  }, [])

  const startRun = useCallback(async () => {
    setRunState("running")
    setProgress(0)
    setMessage("Submitting job")
    setError(null)
    setSelectedObservation(observationId)

    try {
      const { jobId } = await startInference(observationId)

      // Follow the job over Server-Sent Events. Every message carries the
      // backend's real progress percentage and the step it is on.
      closeStreamRef.current = streamJobStatus(
        jobId,
        (job) => {
          setProgress(job.progress)
          setMessage(job.message)
        },
        (job) => {
          closeStreamRef.current = null
          if (job.status === "complete") {
            setProgress(100)
            setRunState("complete")
          } else {
            setError(job.error ?? job.message)
            setRunState("failed")
          }
        },
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inference failed")
      setRunState("failed")
    }
  }, [observationId])

  const viewResults = useCallback(() => {
    setSelectedObservation(observationId)
    router.push("/results")
  }, [router, observationId])

  return (
    <div className="flex flex-col gap-6">
      {offline && (
        <Alert>
          <WifiOff />
          <AlertTitle>Backend unreachable</AlertTitle>
          <AlertDescription>
            Live inference needs the local backend. Start it with{" "}
            <code className="font-mono text-xs">python backend/run.py</code>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
              Pipeline
            </CardTitle>
            <CardDescription>
              Both stages run in order on every observation
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {stages
              .slice()
              .sort((a, b) => a.stage - b.stage)
              .map((stage, index) => (
                <div key={stage.id} className="flex flex-col gap-2.5">
                  {index > 0 && (
                    <ArrowDown
                      className="ml-[13px] size-4 text-border"
                      strokeWidth={1.75}
                    />
                  )}
                  <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-secondary/20 px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {stage.type === "machine-learning" ? (
                          <Cpu className="size-4 text-primary" strokeWidth={1.75} />
                        ) : (
                          <Sigma className="size-4 text-primary" strokeWidth={1.75} />
                        )}
                        <span className="text-sm font-medium text-foreground">
                          {stage.name}
                        </span>
                      </div>
                      <Badge
                        variant={stage.type === "machine-learning" ? "default" : "secondary"}
                        className="font-mono text-[10px] uppercase"
                      >
                        {stage.typeLabel}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {stage.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                      <span>Stage {stage.stage}</span>
                      <span className="text-border">·</span>
                      <span>{stage.output}</span>
                      <span className="text-border">·</span>
                      <span>{stage.accuracy}</span>
                    </div>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
              Run inference
            </CardTitle>
            <CardDescription>{selectedObservation?.name}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                Observation
              </span>
              <Select
                value={observationId}
                onValueChange={(value) => {
                  if (!value) return
                  setObservationId(value)
                  setSelectedObservation(value)
                }}
              >
                <SelectTrigger className="w-full" disabled={runState === "running"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {observations.map((obs) => (
                      <SelectItem key={obs.id} value={obs.id}>
                        {obs.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {runState === "idle" && (
              <>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Run the full pipeline against the selected observation, or skip
                  straight to precomputed results to explore the analysis workspace.
                </p>
                <div className="flex flex-col gap-2.5">
                  <Button onClick={startRun} disabled={offline}>
                    <Zap data-icon="inline-start" />
                    Run live inference
                  </Button>
                  <Button variant="outline" onClick={viewResults}>
                    Load precomputed results
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </>
            )}

            {runState === "running" && (
              <>
                <div className="flex items-center gap-2.5">
                  <Loader2 className="size-4 animate-spin text-primary" strokeWidth={2} />
                  <span className="text-sm text-foreground">{message}</span>
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
                </div>
                <Button onClick={viewResults}>
                  View results
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                  <Orbit data-icon="inline-start" />
                  Open dashboard
                </Button>
                <Button variant="ghost" onClick={startRun}>
                  Run again
                </Button>
              </>
            )}

            {runState === "failed" && (
              <>
                <Alert variant="destructive">
                  <WifiOff />
                  <AlertTitle>Inference failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={startRun}>Try again</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
