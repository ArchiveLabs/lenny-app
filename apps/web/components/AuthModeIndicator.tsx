"use client"

import { useQuery } from "@tanstack/react-query"
import { Shield, ShieldAlert, Key } from "lucide-react"
import { useTranslation } from "react-i18next"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { AuthModeConfig, AuthModeConfigSchema } from "@/types/api"

export function AuthModeIndicator() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({
    queryKey: ["auth-mode"],
    queryFn: async () => {
      const res = await fetchAdmin("settings/auth-mode")
      return handleApiResponse<AuthModeConfig>(res, AuthModeConfigSchema)
    },
    staleTime: 60 * 1000, // 1 minute
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/50 border animate-pulse">
        <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
        <span className="text-xs font-medium text-muted-foreground">{t("Checking mode...")}</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400" title="Failed to load Auth Mode">
        <ShieldAlert className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{t("Unknown")}</span>
      </div>
    )
  }

  if (data.lending_mode === "none") {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
        <ShieldAlert className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{t("Lending Disabled")}</span>
      </div>
    )
  }

  if (data.lending_mode === "ol") {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400">
        <Key className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{t("OpenLibrary")}</span>
      </div>
    )
  }

  if (data.lending_mode === "external") {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400">
        <Shield className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{t("External OAuth")}</span>
      </div>
    )
  }

  return null
}
