"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileUp, FileText, Orbit, X, Check, Loader2, ArrowRight, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { demoObservations, type Observation } from "@/lib/demo-data"
import { fetchObservations, uploadObservation } from "@/lib/api"
import { setSelectedObservation } from "@/lib/selection"
import { LightCurvePreview } from "@/components/upload/light-curve-preview"

type PipelineStep = "idle" | "parsing" | "validating" | "ready"

type IngestedFile = {
  observationId: string
  name: string
  sizeLabel: string
  rows: number
  columns: string[]
  depthColumn: string | null
  wavelengthColumn: string | null
  preview: { wavelength: number; depth: number }[]
}

const STEP_LABELS: { key: PipelineStep; label: string }[] = [
  { key: "parsing", label: "Parsing time series" },
  { key: "validating", label: "Validating cadence" },
  { key: "ready", label: "Ready for inference" },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadWorkspace() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<IngestedFile | null>(null)
  const [step, setStep] = useState<PipelineStep>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [archive, setArchive] = useState<Observation[]>(demoObservations)
  const [selectedArchive, setSelectedArchive] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  // The Ariel archive tab lists the catalogue the backend loaded from
  // test_array.npy (20 real planets).
  useEffect(() => {
    const controller = new AbortController()

    fetchObservations(controller.signal)
      .then((list) => {
        const precomputed = list.filter((o) => o.source === "precomputed")
        if (precomputed.length > 0) setArchive(precomputed)
        setOffline(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setOffline(true)
      })

    return () => controller.abort()
  }, [])

  const handleFile = useCallback(async (fileList: FileList | null) => {
    const target = fileList?.[0]
    if (!target) return

    setError(null)
    setSelectedArchive(null)
    setStep("parsing")
    setProgress(25)

    try {
      // The backend parses the file, resamples it onto the 283-bin Ariel grid
      // and returns a small preview plus the new observation id.
      const uploaded = await uploadObservation(target)

      setStep("validating")
      setProgress(70)

      setFile({
        observationId: uploaded.id,
        name: uploaded.name,
        sizeLabel: formatBytes(uploaded.sizeBytes),
        rows: uploaded.rows,
        columns: uploaded.columns,
        depthColumn: uploaded.depthColumn,
        wavelengthColumn: uploaded.wavelengthColumn,
        preview: uploaded.preview,
      })
      setSelectedObservation(uploaded.id)
      setStep("ready")
      setProgress(100)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed")
      setStep("idle")
      setProgress(0)
      setFile(null)
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragActive(false)
      void handleFile(e.dataTransfer.files)
    },
    [handleFile],
  )

  const reset = useCallback(() => {
    setFile(null)
    setStep("idle")
    setProgress(0)
    setError(null)
    setSelectedArchive(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  const selectArchiveObservation = useCallback(
    (id: string) => {
      const obs = archive.find((o) => o.id === id)
      if (!obs) return

      setError(null)
      setSelectedArchive(id)
      setSelectedObservation(id)
      setFile({
        observationId: id,
        name: obs.name,
        sizeLabel: "Ariel archive",
        rows: 283,
        columns: ["wavelength", "transit_depth"],
        depthColumn: "transit_depth",
        wavelengthColumn: "wavelength",
        preview: [],
      })
      setStep("ready")
      setProgress(100)
    },
    [archive],
  )

  const continueToInference = useCallback(() => {
    if (file) setSelectedObservation(file.observationId)
    router.push("/inference")
  }, [router, file])

  return (
    <div className="flex flex-col gap-6">
      {offline && (
        <Alert>
          <WifiOff />
          <AlertTitle>Backend unreachable</AlertTitle>
          <AlertDescription>
            Uploads need the local backend. Start it with{" "}
            <code className="font-mono text-xs">python backend/run.py</code>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
              Observation source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="file">
              <TabsList className="w-full">
                <TabsTrigger value="file" className="flex-1">
                  Upload file
                </TabsTrigger>
                <TabsTrigger value="archive" className="flex-1">
                  Ariel archive
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="pt-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragActive(true)
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={onDrop}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 bg-secondary/20 px-6 py-12 text-center transition-colors",
                    dragActive && "border-primary/60 bg-primary/5",
                  )}
                >
                  <span className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-secondary/60">
                    <FileUp className="size-5 text-primary" strokeWidth={1.75} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">
                      Drag and drop a CSV, FITS or NPY file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Needs a wavelength column and a transit-depth column (ppm or
                      fraction). Column names are matched loosely.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={offline || step === "parsing"}
                    onClick={() => inputRef.current?.click()}
                  >
                    Browse files
                  </Button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.fits,.fit,.txt,.tsv,.npy"
                    className="sr-only"
                    onChange={(e) => void handleFile(e.target.files)}
                  />
                </div>

                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <WifiOff />
                    <AlertTitle>Could not read that file</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="archive" className="pt-4">
                <ScrollArea className="h-80">
                  <div className="flex flex-col gap-2 pr-3">
                    {archive.map((obs) => (
                      <button
                        key={obs.id}
                        onClick={() => selectArchiveObservation(obs.id)}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/20 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40",
                          selectedArchive === obs.id && "border-primary/60 bg-primary/5",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Orbit className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              {obs.name}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {obs.instrument}
                            </span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                          {obs.status}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
              Processing status
            </CardTitle>
            <CardDescription>
              {file ? file.name : "No observation selected yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {!file && step === "idle" && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Upload a file or pick an archive entry to see column validation and a
                data preview before running inference.
              </p>
            )}

            {!file && step === "parsing" && (
              <div className="flex items-center gap-2.5">
                <Loader2 className="size-4 animate-spin text-primary" strokeWidth={2} />
                <span className="text-sm text-foreground">Uploading and parsing…</span>
              </div>
            )}

            {file && (
              <>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-secondary/30 px-3 py-2.5">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <FileText className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
                    <div className="flex flex-col overflow-hidden">
                      <span className="truncate text-sm text-foreground">{file.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {file.sizeLabel} · {file.rows.toLocaleString()} rows
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={reset}>
                    <X />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>

                <div className="flex flex-col gap-2.5">
                  {STEP_LABELS.map((s, i) => {
                    const stepIndex = STEP_LABELS.findIndex((x) => x.key === step)
                    const done = stepIndex > i || step === "ready"
                    const active = s.key === step
                    return (
                      <div key={s.key} className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]",
                            done
                              ? "border-primary bg-primary text-primary-foreground"
                              : active
                                ? "border-primary text-primary"
                                : "border-border/60 text-muted-foreground",
                          )}
                        >
                          {done ? (
                            <Check className="size-3" strokeWidth={2.5} />
                          ) : active ? (
                            <Loader2 className="size-3 animate-spin" strokeWidth={2.5} />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <span
                          className={cn(
                            "text-sm",
                            done || active ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {s.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <Progress value={progress} />

                {step === "ready" && (
                  <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
                    <div className="grid grid-cols-2 gap-3 font-mono text-xs text-muted-foreground">
                      <span>
                        Columns: <span className="text-foreground">{file.columns.length}</span>
                      </span>
                      <span>
                        Depth col:{" "}
                        <span className="text-foreground">{file.depthColumn ?? "auto"}</span>
                      </span>
                      <span>
                        Wavelength col:{" "}
                        <span className="text-foreground">
                          {file.wavelengthColumn ?? "auto"}
                        </span>
                      </span>
                      <span>
                        Resampled to: <span className="text-foreground">283 bins</span>
                      </span>
                    </div>
                    <LightCurvePreview seed={file.rows} points={file.preview} />
                    <Button className="mt-1" onClick={continueToInference}>
                      Continue to inference
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
