"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { redirectToLogin } from "@/lib/api-client"
import { ApiError } from "@/types/api"

export type ErrorKind = "unreachable" | "gone" | "expired" | "signin" | "other"

/** Only a 502 means Open Library itself is down; the other statuses are our own server telling us something else. */
export function errorKind(e: unknown): ErrorKind {
  const status = e instanceof ApiError ? e.status : undefined
  if (status === 502) return "unreachable"
  if (status === 404) return "gone"
  if (status === 410) return "expired"
  if (status === 401 || status === 403) return "signin"
  return "other"
}

const GENERIC = /^(something went wrong\.?|the server had a problem.*|not found\.?|failed to fetch)$/i

export function EditionError({ error, onRetry, onStartOver }: { error: unknown; onRetry: () => void; onStartOver: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const kind = errorKind(error)

  useEffect(() => {
    if (kind === "signin") void redirectToLogin()
    // The list changed under us (a removed row, an expired batch): reload it so the page matches the server.
    if (kind === "gone" || kind === "expired") {
      qc.invalidateQueries({ queryKey: ["import-batch"] })
      qc.invalidateQueries({ queryKey: ["import-rows"] })
      qc.invalidateQueries({ queryKey: ["import-batches"] })
    }
  }, [kind, qc])

  const detail = error instanceof Error && !GENERIC.test(error.message) ? error.message : null

  return (
    <div role="alert" className="space-y-2 text-sm">
      {kind === "unreachable" && <p className="text-red-700">{t("Open Library did not answer. Try again in a moment.")}</p>}
      {kind === "gone" && <p className="text-red-700">{t("This book is no longer in the list.")}</p>}
      {kind === "expired" && <p className="text-red-700">{t("This list has expired.")}</p>}
      {kind === "signin" && <p className="text-red-700">{t("Your session ended. Taking you to sign in…")}</p>}
      {kind === "other" && (
        <>
          <p className="text-red-700">{t("Something went wrong. Try again.")}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </>
      )}
      {(kind === "unreachable" || kind === "other") && (
        <Button size="sm" variant="outline" onClick={onRetry}>{t("Try again")}</Button>
      )}
      {kind === "expired" && <Button size="sm" variant="outline" onClick={onStartOver}>{t("Start over")}</Button>}
    </div>
  )
}
