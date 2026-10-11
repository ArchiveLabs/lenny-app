export type CopyResult = "copied" | "blocked"
export type ShareResult = "shared" | CopyResult

/** Copy text to the clipboard. "blocked" when the browser will not let the page (no permission, or not a secure page). */
export async function copyText(text: string): Promise<CopyResult> {
  try {
    await navigator.clipboard.writeText(text)
    return "copied"
  } catch {
    return "blocked"
  }
}

/**
 * Hand a link to the system share sheet where there is one (phones). If that is cancelled or fails, copy it instead.
 */
export async function shareLink({ title, url }: { title: string; url: string }): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url })
      return "shared"
    } catch {
      // cancelled or not allowed: fall through to copying
    }
  }
  return copyText(url)
}
