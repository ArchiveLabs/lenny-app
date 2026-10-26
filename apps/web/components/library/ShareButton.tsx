"use client"

import { useState } from "react"
import { Share2 } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Popover, PopoverAnchor, PopoverContent } from "@workspace/ui/components/popover"
import { useLibraryLinks } from "@/hooks/use-library-links"
import { readerBookLink } from "@/lib/library/links"
import { shareLink } from "@/lib/library/share"

export const COPIED_TOAST_MS = 2000

/** Share one book's reader link: copy it, or the system share sheet on phones. Hidden when the links are not available. */
export function ShareButton({ olid, title, compact }: { olid: string | number; title: string; compact?: boolean }) {
  const { t } = useTranslation()
  const { data: links } = useLibraryLinks()
  const [manual, setManual] = useState(false) // clipboard blocked: show the link to copy by hand
  if (!links) return null
  const url = readerBookLink(links, olid)

  return (
    <Popover open={manual} onOpenChange={setManual}>
      <PopoverAnchor asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={`${compact ? "h-6 w-6" : "h-7 w-7"} text-muted-foreground hover:text-foreground`}
          aria-label={t("Share {{title}}", { title })}
          title={t("Share this book's link")}
          onClick={async (e) => {
            e.stopPropagation() // inside a card that opens the book sheet
            const result = await shareLink({ title, url })
            if (result === "copied") toast.success(t("Link copied"), { duration: COPIED_TOAST_MS })
            else if (result === "blocked") setManual(true)
          }}
        >
          <Share2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        </Button>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-80 space-y-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium">{t("Copy this link")}</p>
        <Input readOnly value={url} aria-label={t("Link to share")} autoFocus onFocus={(e) => e.currentTarget.select()} />
        <p className="text-xs text-muted-foreground">{t("Your browser did not allow copying. Select the link and copy it.")}</p>
      </PopoverContent>
    </Popover>
  )
}
