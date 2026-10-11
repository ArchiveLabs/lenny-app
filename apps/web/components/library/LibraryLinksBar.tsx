"use client"

import { BookOpenText, Copy, Info, Rss } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { useLibraryLinks } from "@/hooks/use-library-links"
import { readerUrl } from "@/lib/library/links"
import { copyText } from "@/lib/library/share"
import { COPIED_TOAST_MS } from "./ShareButton"

/** The catalog feed and the Internet Archive reader, for the top of the Library. Hidden when the links are unavailable. */
export function LibraryLinksBar() {
  const { t } = useTranslation()
  const { data: links } = useLibraryLinks()
  if (!links) return null

  return (
    <div className="flex flex-col gap-2 lg:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {/* The feed and its copy button read as one control */}
        <div className="flex items-center">
          <Button asChild variant="outline" className="rounded-r-none font-semibold shadow-sm" title={t("Lenny's catalog feed for reading apps")}>
            <a href={links.opds_feed} target="_blank" rel="noopener noreferrer">
              <Rss className="mr-2 h-4 w-4" aria-hidden />
              {t("OPDS feed")}
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-l-none border-l-0 shadow-sm"
            aria-label={t("Copy the OPDS feed link")}
            title={t("Copy the OPDS feed link")}
            onClick={async () => {
              if ((await copyText(links.opds_feed)) === "copied") toast.success(t("Link copied"), { duration: COPIED_TOAST_MS })
              else toast.message(links.opds_feed) // blocked: show it so it can be copied by hand
            }}
          >
            <Copy className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <Button asChild variant="outline" className="font-semibold shadow-sm" title={t("Browse this library in Internet Archive's reader")}>
          <a href={readerUrl(links)} target="_blank" rel="noopener noreferrer">
            <BookOpenText className="mr-2 h-4 w-4" aria-hidden />
            {t("Open in Internet Archive reader")}
          </a>
        </Button>
      </div>
      {!links.is_public && (
        <Alert role="note" className="max-w-md border-amber-200 bg-amber-50 text-amber-900">
          <Info aria-hidden />
          <AlertDescription className="text-xs text-inherit">
            {t("These links only work on your own network. Set LENNY_PUBLIC_URL to your domain or tunnel to share them with others.")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
