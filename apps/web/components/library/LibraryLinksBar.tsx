"use client"

import { BookOpenText, Copy, Rss } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { useLibraryLinks } from "@/hooks/use-library-links"
import { copyText } from "@/lib/library/share"
import { COPIED_TOAST_MS } from "./ShareButton"

/** The catalog feed and the Internet Archive reader, for the top of the Library. Hidden when the links are unavailable. */
export function LibraryLinksBar() {
  const { t } = useTranslation()
  const { data: links } = useLibraryLinks()
  if (!links) return null

  return (
    <div className="flex flex-wrap items-stretch gap-2 lg:justify-end">
      {/* The feed and its copy button read as one control */}
      <div className="flex items-stretch">
        <Button
          asChild
          variant="outline"
          className="h-auto min-h-8 rounded-r-none text-xs font-semibold shadow-sm sm:min-h-9 sm:text-sm"
          title={t("Lenny's catalog feed for reading apps")}
        >
          <a href={links.opds_feed} target="_blank" rel="noopener noreferrer">
            <Rss className="mr-2 h-4 w-4" aria-hidden />
            {t("OPDS feed")}
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-l-none border-l-0 shadow-sm sm:h-9 sm:w-9"
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
      <Button
        asChild
        variant="outline"
        className="h-auto min-h-8 text-xs font-semibold shadow-sm sm:min-h-9 sm:text-sm"
        title={t("Browse this library in Internet Archive's reader")}
      >
        <a href={links.reader_url} target="_blank" rel="noopener noreferrer" aria-label={t("Open in Internet Archive reader")}>
          <BookOpenText className="mr-2 h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{t("Open in Internet Archive reader")}</span>
          <span className="sm:hidden">{t("Archive reader")}</span>
        </a>
      </Button>
    </div>
  )
}
