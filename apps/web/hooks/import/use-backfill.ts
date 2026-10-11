"use client"

import { useEffect, useRef } from "react"
import { needsDetails } from "@/lib/import/display"
import type { ImportRow } from "@/types/import"

/**
 * Rows linked to an edition before the server kept its details have no title to show. Ask the server once per
 * row, in the background, to fill them in; the row shows its OL id until the answer arrives.
 */
export function useBackfillMatchDetails(rows: ImportRow[], fill: (row: ImportRow) => Promise<unknown>) {
  const asked = useRef(new Set<number>())
  const latest = useRef(fill)
  latest.current = fill
  useEffect(() => {
    for (const r of rows) {
      if (!needsDetails(r) || asked.current.has(r.id)) continue
      asked.current.add(r.id)
      // Promise.resolve first, so even a throwing callback cannot break rendering: the OL id stays on screen.
      Promise.resolve().then(() => latest.current(r)).catch(() => {})
    }
  }, [rows])
}
