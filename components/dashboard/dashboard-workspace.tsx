"use client"

import { useMemo, useState } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { demoObservations, generateSpectrum, demoChemicalComposition } from "@/lib/demo-data"
import { SpectrumChart } from "@/components/dashboard/spectrum-chart"
import { CompositionChart } from "@/components/dashboard/composition-chart"
import { WavelengthDetail } from "@/components/dashboard/wavelength-detail"

export function DashboardWorkspace() {
  const [observationId, setObservationId] = useState(demoObservations[0].id)
  const [activeWavelength, setActiveWavelength] = useState<number | null>(null)

  const observation = demoObservations.find((o) => o.id === observationId) ?? demoObservations[0]

  const spectrum = useMemo(
    () => generateSpectrum(observationId.length + observationId.charCodeAt(4)),
    [observationId],
  )

  const activePoint =
    spectrum.find((p) => p.wavelength === activeWavelength) ?? spectrum[Math.floor(spectrum.length / 2)]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
            Observation
          </span>
          <Select value={observationId} onValueChange={setObservationId}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {demoObservations.map((obs) => (
                  <SelectItem key={obs.id} value={obs.id}>
                    {obs.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary" className="w-fit font-mono text-[10px] uppercase">
          {observation.instrument}
        </Badge>
      </div>

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
          <SpectrumChart data={spectrum} onPointHover={setActiveWavelength} />
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
            <CompositionChart data={demoChemicalComposition} />
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
            <WavelengthDetail point={activePoint} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
