// A finished import's result panel can be put away. Remembered in this browser only, so it stays away after leaving
// the page and coming back; a convenience, never required, and a blocked store just means it shows again.
const KEY = "lenny-import-dismissed"

export const resultKey = (batchId: number, jobId: string) => `${batchId}:${jobId}`

export function readDismissed(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function writeDismissed(key: string) {
  try {
    localStorage.setItem(KEY, key)
  } catch {
    // private window or blocked storage
  }
}
