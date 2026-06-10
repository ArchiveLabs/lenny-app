"use client"

import { WifiOff, RefreshCw } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ApiError } from "@/types/api"
import { useTranslation } from "react-i18next"

export function ErrorState({ 
  error, 
  onRetry, 
  message, 
  retry 
}: { 
  error?: ApiError | Error; 
  onRetry?: () => void;
  message?: string;
  retry?: () => void;
}) {
  const { t } = useTranslation()
  const displayMessage = message || error?.message || t("An unknown error occurred.");
  const handleRetry = onRetry || retry;

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center max-w-lg mx-auto gap-6">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
        <WifiOff className="w-9 h-9 text-red-500/60" />
      </div>
      <div className="space-y-2">
        <h3 className="text-2xl font-bold">{t("Lenny is unreachable")}</h3>
        <p className="text-muted-foreground text-base leading-relaxed">
          {t("The admin UI couldn't connect to the Lenny backend. Make sure the FastAPI server is running and reachable.")}
        </p>
      </div>
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 px-4 py-2.5 text-sm font-mono text-red-700 dark:text-red-400 w-full text-left">
        {displayMessage}
      </div>
      {handleRetry && (
        <Button onClick={handleRetry} className="font-semibold">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("Try Again")}
        </Button>
      )}
    </div>
  )
}
