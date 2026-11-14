"use client"

import type { ReactNode } from "react"
import { CopyButton } from "@/components/copy-button"

/** One style for every field label and helper line in the book sheet. */
export const FIELD_LABEL = "block text-sm font-medium"
export const FIELD_HELP = "text-[13px] leading-relaxed text-muted-foreground"

/**
 * A value to copy (a link, a snippet), shown whole in a small monospace box that wraps instead of
 * cutting it off, with the Copy button on the label row.
 */
export function CodeField({ id, label, value, copyLabel, help }: { id: string; label: string; value: string; copyLabel: string; help?: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={FIELD_LABEL}>{label}</label>
        <CopyButton value={value} ariaLabel={copyLabel} />
      </div>
      <textarea
        id={id}
        readOnly
        rows={1}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="block w-full resize-none rounded-md border bg-muted/40 px-3 py-2 font-mono text-[13px] leading-relaxed break-all text-foreground outline-none field-sizing-content focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      {help && <p className={FIELD_HELP}>{help}</p>}
    </div>
  )
}
