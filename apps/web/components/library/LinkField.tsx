"use client"

import { useRef } from "react"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useLibraryLinks } from "@/hooks/use-library-links"
import { bookLink } from "@/lib/library/links"
import { copyText } from "@/lib/library/share"
import { COPIED_TOAST_MS } from "./ShareButton"

/** The book's OPDS link in a read-only field with a copy button, for the book sheet. Hidden when links are unavailable. */
export function LinkField({ olid, encrypted }: { olid: string | number; encrypted?: boolean }) {
  const { t } = useTranslation()
  const { data: links } = useLibraryLinks()
  const input = useRef<HTMLInputElement>(null)
  if (!links) return null
  const url = bookLink(links, olid)

  return (
    <div className="space-y-2">
      <label htmlFor="share-link" className="text-xs font-normal text-muted-foreground">{t("Share link (OPDS)")}</label>
      <div className="flex gap-2">
        <Input id="share-link" ref={input} readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={t("Copy link")}
          onClick={async () => {
            if ((await copyText(url)) === "copied") toast.success(t("Link copied"), { duration: COPIED_TOAST_MS })
            else input.current?.select() // blocked: select it so it can be copied by hand
          }}
        >
          <Copy className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {encrypted && <p className="text-xs text-amber-700">{t("This book requires a login to read.")}</p>}
    </div>
  )
}
