// Central API client for the Exoplanet Spectrum Recovery frontend.
// The FastAPI backend runs locally (see backend/README.md) and is expected at
// NEXT_PUBLIC_API_URL. Falls back to localhost:8000 for local development.
//
// Every function here throws on failure. Callers catch and fall back to the
// bundled demo data in lib/demo-data.ts, so the UI still works offline.

import type { ChemicalAbundance, SpectrumPoint } from "@/lib/demo-data"

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000"

export const API_ROUTES = {
  health: `${API_BASE_URL}/api/health`,
  models: `${API_BASE_URL}/api/models`,
  upload: `${API_BASE_URL}/api/upload`,
  inference: `${API_BASE_URL}/api/inference`,
  observations: `${API_BASE_URL}/api/observations`,
  results: (id: string) => `${API_BASE_URL}/api/results/${id}`,
  demoResults: `${API_BASE_URL}/api/demo-results`,
  status: (jobId: string) => `${API_BASE_URL}/api/status/${jobId}`,
  chemicalComposition: (id: string) => `${API_BASE_URL}/api/chemical-composition/${id}`,
  exportCsv: (id: string) => `${API_BASE_URL}/api/results/${id}/export.csv`,
} as const

export type ApiStatus = "idle" | "connecting" | "online" | "offline"

// ─── Response shapes ─────────────────────────────────────────────────────────

export type ApiObservation = {
  id: string
  name: string
  target: string
  instrument: string
  source: "uploaded" | "precomputed"
  status: "queued" | "processing" | "complete" | "failed"
  createdAt: string
}

/** One stage of the pipeline. Both always run — these are not alternatives. */
export type ApiModel = {
  id: string
  stage: number
  name: string
  type: "statistical" | "machine-learning"
  typeLabel: string
  description: string
  output: string
  accuracy: string
}

export type Triplet = { value: number; lower: number; upper: number }

export type ApiResult = {
  id: string
  stages: { id: string; name: string; type: string }[]
  createdAt: string
  observation: {
    id: string
    name: string
    target: string
    instrument: string
    source: "uploaded" | "precomputed"
    params?: Record<string, number>
  }
  spectrum: SpectrumPoint[]
  composition: ChemicalAbundance[]
  planetProperties: { radiusJupiter: Triplet; temperatureK: Triplet }
  metrics: {
    noiseReductionPercent: number
    meanSigmaPpm: number
    bins: number
    stage2Bins: number
    rmsePpm?: number
    observedRmsePpm?: number
  }
}

export type ApiJob = {
  jobId: string
  observationId: string
  status: "queued" | "running" | "complete" | "failed"
  progress: number
  message: string
  error: string | null
}

export type UploadResponse = {
  id: string
  name: string
  rows: number
  columns: string[]
  sizeBytes: number
  depthColumn: string | null
  wavelengthColumn: string | null
  preview: { wavelength: number; depth: number }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `Request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

/**
 * Lightweight reachability check for the local backend. Used to drive the
 * "link status" indicator in the site header and to decide whether to fall
 * back to bundled demo data.
 */
export async function pingBackend(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(API_ROUTES.observations, {
      method: "GET",
      signal,
      cache: "no-store",
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export function fetchObservations(signal?: AbortSignal) {
  return getJson<ApiObservation[]>(API_ROUTES.observations, signal)
}

export function fetchModels(signal?: AbortSignal) {
  return getJson<ApiModel[]>(API_ROUTES.models, signal)
}

export function fetchResult(id: string, signal?: AbortSignal) {
  return getJson<ApiResult>(API_ROUTES.results(id), signal)
}

export function fetchDemoResults(signal?: AbortSignal) {
  return getJson<ApiResult[]>(API_ROUTES.demoResults, signal)
}

export async function uploadObservation(file: File): Promise<UploadResponse> {
  const body = new FormData()
  body.append("file", file)

  const response = await fetch(API_ROUTES.upload, { method: "POST", body })
  if (!response.ok) {
    // FastAPI reports validation problems as { detail: "..." }.
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.detail || `Upload failed: ${response.status}`)
  }
  return (await response.json()) as UploadResponse
}

export async function startInference(observationId: string): Promise<{ jobId: string }> {
  const response = await fetch(API_ROUTES.inference, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ observationId }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.detail || `Inference failed: ${response.status}`)
  }
  return (await response.json()) as { jobId: string }
}

/**
 * Follow a running job over Server-Sent Events.
 *
 * `onUpdate` fires on every progress message; `onDone` fires once when the job
 * reaches "complete" or "failed". Returns a function that closes the stream —
 * call it from a React cleanup so the connection is not left open.
 */
export function streamJobStatus(
  jobId: string,
  onUpdate: (job: ApiJob) => void,
  onDone: (job: ApiJob) => void,
): () => void {
  const source = new EventSource(API_ROUTES.status(jobId))

  source.onmessage = (event) => {
    const job = JSON.parse(event.data) as ApiJob
    onUpdate(job)
    if (job.status === "complete" || job.status === "failed") {
      source.close()
      onDone(job)
    }
  }

  source.onerror = () => {
    source.close()
    onDone({
      jobId,
      observationId: "",
      status: "failed",
      progress: 0,
      message: "Lost connection to the backend",
      error: "stream closed",
    })
  }

  return () => source.close()
}
