"use client"

import { BookPlus, ClipboardList, Library } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

/** Nothing has been preloaded yet, or the catalog is not there: say that, and offer the ways to start. */
export function EmptyPreload({ onBrowse, onPasteList, browsing }: { onBrowse: () => void; onPasteList: () => void; browsing?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4 rounded-xl border border-dashed p-6 text-center sm:p-10">
      <BookPlus className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="text-lg font-semibold">{t("No books added yet")}</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {t("Preload free public-domain books from Standard Ebooks into Lenny. Choose how you want to start.")}
        </p>
      </div>
      <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
          <Library className="h-5 w-5 text-muted-foreground" aria-hidden />
          <p className="font-medium">{t("Browse the catalog")}</p>
          <p className="text-sm text-muted-foreground">{t("Pick books, or add a whole collection.")}</p>
          <Button onClick={onBrowse} disabled={browsing}>{t("Preload books")}</Button>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
          <ClipboardList className="h-5 w-5 text-muted-foreground" aria-hidden />
          <p className="font-medium">{t("Paste a list")}</p>
          <p className="text-sm text-muted-foreground">{t("Standard Ebooks ids or links, one per line.")}</p>
          <Button variant="outline" onClick={onPasteList}>{t("Paste a list")}</Button>
        </div>
      </div>
    </div>
  )
}
