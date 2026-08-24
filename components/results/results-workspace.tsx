"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, FileJson, FileSpreadsheet, FileText, Eye, Loader2, WifiOff } from "lucide-react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { demoObservations, type Observation } from "@/lib/demo-data"
import { API_ROUTES, fetchObservations, fetchResult, type ApiResult } from "@/lib/api"
import { ResultDetailDialog } from "@/components/results/result-detail-dialog"
import { toast } from "sonner"

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

/** Full result as JSON — spectrum, uncertainty bands, composition and metrics. */
async function exportJson(observationId: string) {
  try {
    const result = await fetchResult(observationId)
    downloadBlob(
      JSON.stringify(result, null, 2),
      `${observationId}-results.json`,
      "application/json",
    )
    toast.success("JSON export downloaded")
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Export failed")
  }
}

/** CSV comes straight from the backend so the file matches what the model ran on. */
function exportCsv(observationId: string) {
  window.open(API_ROUTES.exportCsv(observationId), "_blank")
  toast.success("CSV export started")
}

/** A printable one-page summary. Opens the browser print dialog to save as PDF. */
async function exportReport(observationId: string) {
  try {
    const result = await fetchResult(observationId)
    const rows = result.composition
      .map(
        (c) =>
          `<tr><td>${c.molecule} (${c.formula})</td><td>${c.abundance.toFixed(2)}</td><td>${Math.round(
            c.confidence * 100,
          )}%</td></tr>`,
      )
      .join("")

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${result.observation.name} — Recovery report</title>
<style>body{font-family:ui-monospace,monospace;padding:40px;color:#111}h1{font-size:20px}table{border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ccc;padding:6px 10px;font-size:13px;text-align:left}</style>
</head><body>
<h1>${result.observation.name}</h1>
<p>Instrument: ${result.observation.instrument}<br>Pipeline: ${result.stages.map((s) => s.name).join(" → ")}<br>Generated: ${result.createdAt}</p>
<h2>Recovery metrics</h2>
<table><tr><th>Noise removed</th><td>${result.metrics.noiseReductionPercent.toFixed(1)}%</td></tr>
<tr><th>Mean 1σ</th><td>${result.metrics.meanSigmaPpm.toFixed(1)} ppm</td></tr>
${result.metrics.rmsePpm !== undefined ? `<tr><th>RMSE vs truth</th><td>${result.metrics.rmsePpm.toFixed(1)} ppm (observed ${result.metrics.observedRmsePpm?.toFixed(1)} ppm)</td></tr>` : ""}
<tr><th>Planet temperature</th><td>${result.planetProperties.temperatureK.value.toFixed(0)} K</td></tr>
<tr><th>Planet radius</th><td>${result.planetProperties.radiusJupiter.value.toFixed(3)} R<sub>J</sub></td></tr></table>
<h2>Molecular abundances (log10 mixing ratio)</h2>
<table><tr><th>Molecule</th><th>Abundance</th><th>Confidence</th></tr>${rows}</table>
</body></html>`

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast.error("Allow pop-ups to export the report")
      return
    }
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    toast.success("Report ready — save as PDF from the print dialog")
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Export failed")
  }
}

type Row = {
  obs: Observation
  result: ApiResult | null
}

export function ResultsWorkspace() {
  const [detailId, setDetailId] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetchObservations(controller.signal)
      .then(async (list) => {
        setRows(list.map((obs) => ({ obs, result: null })))
        setLoading(false)

        // Fetch each result in turn and fill the row in as it arrives. Doing
        // them one at a time keeps the first request from blocking the others,
        // since the backend computes a result the first time it is asked for.
        for (const obs of list) {
          if (controller.signal.aborted) return
          try {
            const result = await fetchResult(obs.id, controller.signal)
            setRows((current) =>
              current.map((row) => (row.obs.id === obs.id ? { ...row, result } : row)),
            )
          } catch {
            // Leave that row showing "—"; one bad result must not stop the rest.
          }
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setOffline(true)
        setRows(demoObservations.map((obs) => ({ obs, result: null })))
        setLoading(false)
      })

    return () => controller.abort()
  }, [])

  const openDetail = useCallback((id: string) => setDetailId(id), [])

  return (
    <div className="flex flex-col gap-6">
      {offline && (
        <Alert>
          <WifiOff />
          <AlertTitle>Backend unreachable</AlertTitle>
          <AlertDescription>
            Showing the bundled observation list without recovery metrics. Start the
            backend with <code className="font-mono text-xs">python backend/run.py</code>.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border/60 bg-card/60">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
              Recovered observations
            </CardTitle>
            <CardDescription>Per-observation recovery summary and export</CardDescription>
          </div>
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={2} />}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Observation</TableHead>
                <TableHead>Instrument</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Noise removed</TableHead>
                <TableHead>Mean 1σ (ppm)</TableHead>
                <TableHead>Temp (K)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ obs, result }) => (
                <TableRow key={obs.id}>
                  <TableCell className="font-medium text-foreground">{obs.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {obs.instrument}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                      {result ? "complete" : obs.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {result ? `${result.metrics.noiseReductionPercent.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {result ? result.metrics.meanSigmaPpm.toFixed(0) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {result ? result.planetProperties.temperatureK.value.toFixed(0) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={offline}
                        onClick={() => openDetail(obs.id)}
                      >
                        <Eye />
                        <span className="sr-only">View details</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" disabled={offline}>
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
                            <DropdownMenuItem onClick={() => void exportJson(obs.id)}>
                              <FileJson data-icon="inline-start" />
                              Export JSON
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void exportReport(obs.id)}>
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
