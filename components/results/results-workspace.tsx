"use client"

import { useMemo, useState } from "react"
import { Download, FileJson, FileSpreadsheet, FileText, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { demoObservations, generateSpectrum, demoChemicalComposition } from "@/lib/demo-data"
import { ResultDetailDialog } from "@/components/results/result-detail-dialog"
import { toast } from "sonner"

function buildExportPayload(observationId: string) {
  const obs = demoObservations.find((o) => o.id === observationId)
  const spectrum = generateSpectrum(observationId.length + observationId.charCodeAt(4))
  return {
    observation: obs,
    spectrum,
    chemicalComposition: demoChemicalComposition,
    generatedAt: new Date().toISOString(),
  }
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function exportJson(observationId: string) {
  const payload = buildExportPayload(observationId)
  downloadBlob(JSON.stringify(payload, null, 2), `${observationId}-results.json`, "application/json")
  toast.success("JSON export downloaded")
}

function exportCsv(observationId: string) {
  const payload = buildExportPayload(observationId)
  const header = "wavelength,observed,recovered,lower,upper"
  const rows = payload.spectrum.map(
    (p) => `${p.wavelength},${p.observed},${p.recovered},${p.lower},${p.upper}`,
  )
  downloadBlob([header, ...rows].join("\n"), `${observationId}-spectrum.csv`, "text/csv")
  toast.success("CSV export downloaded")
}

function exportPdf(observationId: string) {
  const obs = demoObservations.find((o) => o.id === observationId)
  const html = `<!doctype html><html><head><title>${obs?.name} Report</title></head><body style="font-family: monospace; padding: 40px;"><h1>${obs?.name}</h1><p>Instrument: ${obs?.instrument}</p><p>Status: ${obs?.status}</p><p>Generated: ${new Date().toISOString()}</p></body></html>`
  downloadBlob(html, `${observationId}-report.pdf`, "application/pdf")
  toast.success("PDF report downloaded")
}

export function ResultsWorkspace() {
  const [detailId, setDetailId] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      demoObservations.map((obs) => {
        const spectrum = generateSpectrum(obs.id.length + obs.id.charCodeAt(4))
        const avgResidual =
          spectrum.reduce((sum, p) => sum + Math.abs(p.observed - p.recovered), 0) / spectrum.length
        return { obs, avgResidual }
      }),
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/60 bg-card/60">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
              Recovered observations
            </CardTitle>
            <CardDescription>Per-observation recovery summary and export</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Observation</TableHead>
                <TableHead>Instrument</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Avg. residual (ppm)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ obs, avgResidual }) => (
                <TableRow key={obs.id}>
                  <TableCell className="font-medium text-foreground">{obs.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {obs.instrument}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                      {obs.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {avgResidual.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="icon-sm" onClick={() => setDetailId(obs.id)}>
                        <Eye />
                        <span className="sr-only">View details</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm">
                              <Download />
                              <span className="sr-only">Export</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => exportCsv(obs.id)}>
                              <FileSpreadsheet data-icon="inline-start" />
                              Export CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportJson(obs.id)}>
                              <FileJson data-icon="inline-start" />
                              Export JSON
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportPdf(obs.id)}>
                              <FileText data-icon="inline-start" />
                              Export PDF report
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ResultDetailDialog
        observationId={detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
      />
    </div>
  )
}
