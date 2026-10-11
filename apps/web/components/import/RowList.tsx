"use client"

import type { ImportRow } from "@/types/import"
import { RowItem } from "./RowItem"

type Handlers = {
  onOpen: (r: ImportRow) => void
  onDetails: (r: ImportRow) => void
  onRemove: (r: ImportRow) => void
  onToggleEncrypted: (r: ImportRow) => void
  onSelect: (r: ImportRow, selected: boolean) => void
  selected: ReadonlyMap<number, ImportRow>
  needsFile: (r: ImportRow) => boolean
  upload: (r: ImportRow) => "uploading" | "failed" | undefined
  onRetryUpload: () => void
}

/**
 * One page of rows. A page is at most 50, so they are simply listed: no inner scrolling and no windowing, which
 * also means a row can wrap or change height without overlapping its neighbours.
 */
export function RowList({ rows, ...h }: { rows: ImportRow[] } & Handlers) {
  return (
    <div className="divide-y overflow-hidden rounded-xl border" role="list" aria-label="Books">
      {rows.map((row) => (
        <div key={row.id} role="listitem">
          <RowItem
            row={row}
            needsFile={h.needsFile(row)}
            onOpen={h.onOpen}
            onDetails={h.onDetails}
            onRemove={h.onRemove}
            onSelect={h.onSelect}
            selected={h.selected.has(row.id)}
            upload={h.upload(row)}
            onRetryUpload={h.onRetryUpload}
            onToggleEncrypted={h.onToggleEncrypted}
          />
        </div>
      ))}
    </div>
  )
}
