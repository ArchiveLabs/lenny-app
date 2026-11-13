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
import { CopyButton } from "@/components/copy-button"
import { readButtonHtml } from "@/lib/subscriptions"
import type { AccessMode } from "@/types/api"

/** The book's OPDS link in a read-only field with a copy button, for the book sheet. Hidden when links are unavailable. */
export function LinkField({ olid, mode }: { olid: string | number; mode?: AccessMode }) {
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
      {mode === "borrowable" && <p className="text-xs text-amber-700">{t("This book requires a login to read.")}</p>}
      {mode === "subscription" && (
        <div className="space-y-2 pt-2">
          <label htmlFor="read-button" className="text-xs font-normal text-muted-foreground">{t("Read button for a Ghost post")}</label>
          <div className="flex gap-2">
            <Input id="read-button" readOnly value={readButtonHtml(String(olid))} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            <CopyButton value={readButtonHtml(String(olid))} />
          </div>
          <p className="text-xs text-muted-foreground">{t("Paste it in an HTML card. Only paid members of your Ghost site can read this book.")}</p>
        </div>
      )}
    </div>
  )
}
