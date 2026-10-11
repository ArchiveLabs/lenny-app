"use client"

import { CheckCircle2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

/** Everything loaded has been imported: say so, instead of an empty list with filters, a search box and a dead Import button. */
export function EmptyLoaded({ importedCount, onViewHistory }: { importedCount: number; onViewHistory: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden />
      <p className="font-medium">{t("Nothing waiting to be imported")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("Everything you loaded has been imported. Drop more files above to load them.")}
      </p>
      {importedCount > 0 && (
        <Button size="sm" variant="outline" onClick={onViewHistory}>
          {t("View history ({{n}})", { n: importedCount })}
        </Button>
      )}
    </div>
  )
}
