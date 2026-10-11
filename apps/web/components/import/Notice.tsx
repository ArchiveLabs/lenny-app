"use client"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"

const TONES = {
  error: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "bg-muted/40 text-foreground",
} as const

/** A banner with an optional action on the right. Errors are announced at once (alert); the rest politely (status). */
export function Notice({ tone, action, children }: { tone: keyof typeof TONES; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Alert role={tone === "error" ? "alert" : "status"} className={`${TONES[tone]} flex items-center`}>
      <AlertDescription className="flex w-full flex-wrap items-center gap-3 text-inherit">
        <span className="mr-auto">{children}</span>
        {action}
      </AlertDescription>
    </Alert>
  )
}

