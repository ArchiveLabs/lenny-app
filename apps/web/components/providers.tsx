"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { QueryClientProvider } from "@tanstack/react-query"

import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { Toaster } from "@workspace/ui/components/sonner"
import { queryClient } from "@/lib/query-client"
import "@/lib/i18n"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        forcedTheme="light"
        disableTransitionOnChange
        enableColorScheme
      >
        <TooltipProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </TooltipProvider>
      </NextThemesProvider>
    </QueryClientProvider>
  )
}
