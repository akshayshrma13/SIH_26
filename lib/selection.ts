// Remembers which observation the user is working on as they move between
// Upload -> Inference -> Dashboard -> Results.
//
// It lives in localStorage rather than React state because each page is its
// own route, so component state would be thrown away on navigation. Every
// read is wrapped in try/catch: localStorage throws in private-browsing mode
// and does not exist at all during server rendering.

const OBSERVATION_KEY = "ariel:selected-observation"

export function getSelectedObservation(): string | null {
  try {
    return window.localStorage.getItem(OBSERVATION_KEY)
  } catch {
    return null
  }
}

export function setSelectedObservation(id: string): void {
  try {
    window.localStorage.setItem(OBSERVATION_KEY, id)
  } catch {
    // Nothing to do — the app still works, it just forgets the selection.
  }
}
