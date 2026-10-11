"use client"

import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { ImportRow } from "@/types/import"
import { RowItem } from "./RowItem"

type Handlers = {
  onOpen: (r: ImportRow) => void
  onRemove: (r: ImportRow) => void
  onToggleEncrypted: (r: ImportRow) => void
  needsFile: (r: ImportRow) => boolean
}

/** One page of rows (50), windowed so only the visible ones are in the DOM. */
export function RowList({ rows, ...h }: { rows: ImportRow[] } & Handlers) {
  const parent = useRef<HTMLDivElement>(null)
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parent.current, estimateSize: () => 96, overscan: 8 })
  const items = v.getVirtualItems()

  return (
    <div ref={parent} className="h-[min(60vh,40rem)] min-h-64 overflow-auto rounded-xl border" role="list" aria-label="Books">
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {items.map((it) => {
          const row = rows[it.index]!
          return (
            <div
              key={row.id}
              role="listitem"
              data-index={it.index}
              ref={v.measureElement}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${it.start}px)` }}
            >
              <RowItem row={row} needsFile={h.needsFile(row)} onOpen={h.onOpen} onRemove={h.onRemove} onToggleEncrypted={h.onToggleEncrypted} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
