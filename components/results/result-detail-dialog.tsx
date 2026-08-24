"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { WifiOff } from "lucide-react"
import { fetchResult, type ApiResult } from "@/lib/api"
import { SpectrumChart } from "@/components/dashboard/spectrum-chart"
import { CompositionChart } from "@/components/dashboard/composition-chart"

export function ResultDetailDialog({
  observationId,
  onOpenChange,
}: {
  observationId: string | null
  onOpenChange: (open: boolean) => void
}) {
  // The loaded state is tagged with the observation it belongs to. Reading it
  // back through that tag means opening a different observation shows the
  // loading skeleton again without an extra "clear the old value" update.
  const [loaded, setLoaded] = useState<{
    id: string
    result?: ApiResult
    error?: string
  } | null>(null)

  useEffect(() => {
    if (!observationId) return

    const controller = new AbortController()

    fetchResult(observationId, controller.signal)
      .then((data) => setLoaded({ id: observationId, result: data }))
      .catch((caught: Error) => {
        if (!controller.signal.aborted) {
          setLoaded({ id: observationId, error: caught.message })
        }
      })

    return () => controller.abort()
  }, [observationId])

  const current = loaded?.id === observationId ? loaded : null
  const result = current?.result ?? null
  const error = current?.error ?? null

  return (
    <Dialog open={!!observationId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <DialogTitle>{result?.observation.name ?? "Observation"}</DialogTitle>
            {result && (
              <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                {result.observation.instrument}
              </Badge>
            )}
          </div>
          <DialogDescription>
            Full recovered spectrum and molecular abundance breakdown for this
            observation.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <WifiOff />
            <AlertTitle>Could not load this result</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!result && !error && (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-6">
            <SpectrumChart data={result.spectrum} />
            <div className="border-t border-border/60 pt-4">
              <CompositionChart data={result.composition} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
