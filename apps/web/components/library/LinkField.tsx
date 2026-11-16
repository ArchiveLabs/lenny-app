"use client"

import { useTranslation } from "react-i18next"
import { CodeField } from "@/components/code-field"
import { useLibraryLinks } from "@/hooks/use-library-links"
import { bookLink } from "@/lib/library/links"

/** The book's OPDS link, shown whole with a Copy button, for the book sheet. Hidden when links are unavailable. */
export function LinkField({ olid }: { olid: string | number }) {
  const { t } = useTranslation()
  const { data: links } = useLibraryLinks()
  if (!links) return null
  return (
    <CodeField
      id="share-link"
      label={t("Share link")}
      value={bookLink(links, olid)}
      copyLabel={t("Copy share link")}
      help={t("Paste it into a reading app that supports OPDS.")}
    />
  )
}
