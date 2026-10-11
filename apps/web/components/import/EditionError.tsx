"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ErrorNotice, errorKind, type ErrorTexts } from "@/components/ErrorNotice"

export { errorKind }

const TEXTS: ErrorTexts = {
  unreachable: "Open Library did not answer. Try again in a moment.",
  gone: "This book is no longer in the list.",
  expired: "This list has expired.",
}

/** The edition panel's failures: only a 502 means Open Library is down; 404 and 410 mean the list changed under us. */
export function EditionError({ error, onRetry, onStartOver }: { error: unknown; onRetry: () => void; onStartOver: () => void }) {
  const qc = useQueryClient()
  const kind = errorKind(error)

  useEffect(() => {
    // The list changed under us (a removed row, an expired batch): reload it so the page matches the server.
    if (kind === "gone" || kind === "expired") {
      qc.invalidateQueries({ queryKey: ["import-batch"] })
      qc.invalidateQueries({ queryKey: ["import-rows"] })
      qc.invalidateQueries({ queryKey: ["import-batches"] })
    }
  }, [kind, qc])

  return <ErrorNotice error={error} onRetry={onRetry} onStartOver={onStartOver} texts={TEXTS} />
}
