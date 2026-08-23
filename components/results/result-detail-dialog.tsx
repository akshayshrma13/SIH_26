"use client"

import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { demoObservations, generateSpectrum, demoChemicalComposition } from "@/lib/demo-data"
import { SpectrumChart } from "@/components/dashboard/spectrum-chart"
import { CompositionChart } from "@/components/dashboard/composition-chart"

export function ResultDetailDialog({
  observationId,
  onOpenChange,
}: {
  observationId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const obs = demoObservations.find((o) => o.id === observationId)

  const spectrum = useMemo(() => {
    if (!observationId) return []
    const index = demoObservations.findIndex((o) => o.id === observationId)
    return generateSpectrum(observationId.charCodeAt(4) * (index + 1) * 13)
  }, [observationId])

  return (
    <Dialog open={!!observationId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <DialogTitle>{obs?.name ?? "Observation"}</DialogTitle>
            {obs && (
              <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                {obs.instrument}
              </Badge>
            )}
          </div>
          <DialogDescription>
            Full recovered spectrum and molecular abundance breakdown for this
            observation.
          </DialogDescription>
        </DialogHeader>

        {obs && spectrum.length > 0 && (
          <div className="flex flex-col gap-6">
            <SpectrumChart data={spectrum} />
            <div className="border-t border-border/60 pt-4">
              <CompositionChart data={demoChemicalComposition} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
