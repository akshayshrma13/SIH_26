"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, WifiOff } from "lucide-react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  demoObservations,
  generateSpectrum,
  demoChemicalComposition,
  type Observation,
} from "@/lib/demo-data"
import {
  fetchObservations,
  fetchResult,
  type ApiResult,
} from "@/lib/api"
import { getSelectedObservation, setSelectedObservation } from "@/lib/selection"
import { SpectrumChart } from "@/components/dashboard/spectrum-chart"
import { CompositionChart } from "@/components/dashboard/composition-chart"
import { WavelengthDetail } from "@/components/dashboard/wavelength-detail"

export function DashboardWorkspace() {
  const [observations, setObservations] = useState<Observation[]>(demoObservations)
  const [observationId, setObservationId] = useState<string>(demoObservations[0].id)
  const [result, setResult] = useState<ApiResult | null>(null)
  // "checking" until the first request comes back, so we never fetch a result
  // for a demo id that the backend does not know about.
  const [backend, setBackend] = useState<"checking" | "online" | "offline">("checking")
  // Errors are tagged with the observation they belong to, so switching
  // observations clears the old message without an extra state update.
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null)
  const [activeWavelength, setActiveWavelength] = useState<number | null>(null)

  const offline = backend === "offline"

  // Load the observation list once, and pick up whatever the user selected on
  // the Upload or Inference page.
  useEffect(() => {
    const controller = new AbortController()

    fetchObservations(controller.signal)
      .then((list) => {
        if (list.length === 0) {
          setBackend("offline")
          return
        }
        setObservations(list)
        const remembered = getSelectedObservation()
        setObservationId(
          remembered && list.some((o) => o.id === remembered) ? remembered : list[0].id,
        )
        setBackend("online")
      })
      .catch(() => {
        if (!controller.signal.aborted) setBackend("offline")
      })

    return () => controller.abort()
  }, [])

  // Once the backend is known to be up, fetch the selected observation's
  // result. The backend computes it on first request and caches it after that.
  useEffect(() => {
    if (backend !== "online") return

    const controller = new AbortController()

    fetchResult(observationId, controller.signal)
      .then(setResult)
      .catch((error: Error) => {
        if (controller.signal.aborted) return
        setFailure({ id: observationId, message: error.message })
      })

    return () => controller.abort()
  }, [observationId, backend])

  // Fall back to the bundled demo spectrum when the backend is unreachable.
  const fallbackSpectrum = useMemo(
    () => generateSpectrum(observationId.length + observationId.charCodeAt(4)),
    [observationId],
  )

  // Only show a result (or an error) that belongs to the current selection —
  // while a new one loads, the previous observation's data is not shown.
  const current = result?.id === observationId ? result : null
  const resultError = failure?.id === observationId ? failure.message : null
  const loading = backend === "checking" || (backend === "online" && !current && !resultError)

  const spectrum = offline ? fallbackSpectrum : (current?.spectrum ?? [])
  const composition = offline ? demoChemicalComposition : (current?.composition ?? [])
  const observation = observations.find((o) => o.id === observationId) ?? observations[0]

  const activePoint =
    spectrum.find((p) => p.wavelength === activeWavelength) ??
    spectrum[Math.floor(spectrum.length / 2)]

  return (
    <div className="flex flex-col gap-6">
      {offline && (
        <Alert>
          <WifiOff />
          <AlertTitle>Backend unreachable</AlertTitle>
          <AlertDescription>
            Showing bundled demo data. Start the backend with{" "}
            <code className="font-mono text-xs">python backend/run.py</code> to see real
            model output.
          </AlertDescription>
        </Alert>
      )}

      {resultError && (
        <Alert variant="destructive">
          <WifiOff />
          <AlertTitle>Could not load this result</AlertTitle>
          <AlertDescription>{resultError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
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
            <SelectTrigger className="w-72">
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
          {loading && !offline && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={2} />
          )}
        </div>
        <Badge variant="secondary" className="w-fit font-mono text-[10px] uppercase">
          {observation?.instrument}
        </Badge>
      </div>

      {current && !offline && <MetricsRow result={current} />}

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Transmission spectrum
          </CardTitle>
          <CardDescription>
            Observed transit depth vs. model-recovered spectrum with 1σ uncertainty band
          </CardDescription>
        </CardHeader>
        <CardContent>
          {spectrum.length > 0 ? (
            <SpectrumChart data={spectrum} onPointHover={setActiveWavelength} />
          ) : (
            <Skeleton className="h-80 w-full" />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
              Molecular abundances
            </CardTitle>
            <CardDescription>Retrieved log10 mixing ratios and posterior confidence</CardDescription>
          </CardHeader>
          <CardContent>
            {composition.length > 0 ? (
              <CompositionChart data={composition} />
            ) : (
              <Skeleton className="h-56 w-full" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
              Wavelength detail
            </CardTitle>
            <CardDescription>
              {activeWavelength ? "Hover point on spectrum chart" : "Showing mid-band sample channel"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activePoint ? <WavelengthDetail point={activePoint} /> : <Skeleton className="h-48 w-full" />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** The four headline numbers the backend reports for a finished recovery. */
function MetricsRow({ result }: { result: ApiResult }) {
  const { metrics, planetProperties } = result

  const tiles = [
    {
      label: "Noise removed",
      value: `${metrics.noiseReductionPercent.toFixed(1)}%`,
    },
    {
      label: "Mean 1σ",
      value: `${metrics.meanSigmaPpm.toFixed(0)} ppm`,
    },
    {
      label: "Planet temp",
      value: `${planetProperties.temperatureK.value.toFixed(0)} K`,
      hint: `±${(
        (planetProperties.temperatureK.upper - planetProperties.temperatureK.lower) / 2
      ).toFixed(0)}`,
    },
    {
      label: "Planet radius",
      value: `${planetProperties.radiusJupiter.value.toFixed(2)} Rⱼ`,
    },
  ]

  // Only catalogue planets have a known clean spectrum to compare against.
  if (metrics.rmsePpm !== undefined && metrics.observedRmsePpm !== undefined) {
    tiles.push({
      label: "RMSE vs truth",
      value: `${metrics.rmsePpm.toFixed(0)} ppm`,
      hint: `was ${metrics.observedRmsePpm.toFixed(0)}`,
    })
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex flex-col gap-1 rounded-md border border-border/60 bg-secondary/20 px-3 py-2.5"
        >
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
            {tile.label}
          </span>
          <span className="font-mono text-lg text-foreground">
            {tile.value}
            {tile.hint && (
              <span className="ml-1.5 text-xs text-muted-foreground">{tile.hint}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
