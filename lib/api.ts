// Central API configuration for the Exoplanet Spectrum Recovery frontend.
// The FastAPI backend runs locally (see BACKEND_PLAN.md) and is expected at
// NEXT_PUBLIC_API_URL. Falls back to localhost:8000 for local development.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000"

export const API_ROUTES = {
  upload: `${API_BASE_URL}/api/upload`,
  inference: `${API_BASE_URL}/api/inference`,
  observations: `${API_BASE_URL}/api/observations`,
  results: (id: string) => `${API_BASE_URL}/api/results/${id}`,
  demoResults: `${API_BASE_URL}/api/demo-results`,
  status: (jobId: string) => `${API_BASE_URL}/api/status/${jobId}`,
  chemicalComposition: (id: string) => `${API_BASE_URL}/api/chemical-composition/${id}`,
} as const

export type ApiStatus = "idle" | "connecting" | "online" | "offline"

/**
 * Lightweight reachability check for the local backend. Used to drive the
 * "link status" indicator in the site header and to decide whether to fall
 * back to bundled demo data.
 */
export async function pingBackend(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/observations`, {
      method: "GET",
      signal,
      cache: "no-store",
    })
    return res.ok
  } catch {
    return false
  }
}
