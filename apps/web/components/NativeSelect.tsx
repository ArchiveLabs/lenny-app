"use client"

import type { ComponentProps } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

/**
 * The browser's own select (so phones get their native picker) with the field styling of the rest of the app and a
 * proper chevron, instead of the small default arrow. Pass the options as children.
 */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative inline-flex">
      <select
        {...props}
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-input bg-background pr-9 pl-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  )
}
