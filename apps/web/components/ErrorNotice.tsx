"use client"

import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { redirectToLogin } from "@/lib/api-client"
import { ApiError } from "@/types/api"

export type ErrorKind = "unreachable" | "gone" | "expired" | "signin" | "other"

/** What a failed request means. A 502 is an outside service being down; every other status is our own server talking. */
export function errorKind(e: unknown): ErrorKind {
  const status = e instanceof ApiError ? e.status : undefined
  if (status === 502) return "unreachable"
  if (status === 404) return "gone"
  if (status === 410) return "expired"
  if (status === 401 || status === 403) return "signin"
  return "other"
}

export type ErrorTexts = Partial<Record<ErrorKind, string>>

const DEFAULT_TEXTS: Record<ErrorKind, string> = {
  unreachable: "The service did not answer. Try again in a moment.",
  gone: "This is not available any more.",
  expired: "This has expired.",
  signin: "Your session ended. Taking you to sign in…",
  other: "Something went wrong. Try again.",
}

const GENERIC = /^(something went wrong\.?|the server had a problem.*|not found\.?|failed to fetch)$/i

/**
 * A failed request in plain words, with a retry where trying again can help. Pass `texts` to say who is unreachable
 * or what is gone. A 401 or 403 sends the admin to sign in.
 */
export function ErrorNotice({
  error,
  onRetry,
  onStartOver,
  texts = {},
  retryOn = ["unreachable", "other"],
  boxed = false,
}: {
  error: unknown
  onRetry: () => void
  onStartOver?: () => void
  texts?: ErrorTexts
  retryOn?: ErrorKind[]
  /** Draw it as a banner of its own, for a page-level failure. */
  boxed?: boolean
}) {
  const { t } = useTranslation()
  const kind = errorKind(error)

  useEffect(() => {
    if (kind === "signin") void redirectToLogin()
  }, [kind])

  const detail = kind === "other" && error instanceof Error && !GENERIC.test(error.message) ? error.message : null

  return (
    <div role="alert" className={`space-y-2 text-sm ${boxed ? "rounded-lg border border-red-200 bg-red-50 p-3" : ""}`}>
      <p className="text-red-700">{t(texts[kind] ?? DEFAULT_TEXTS[kind])}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      {retryOn.includes(kind) && <Button size="sm" variant="outline" onClick={onRetry}>{t("Try again")}</Button>}
      {kind === "expired" && onStartOver && <Button size="sm" variant="outline" onClick={onStartOver}>{t("Start over")}</Button>}
    </div>
  )
}
