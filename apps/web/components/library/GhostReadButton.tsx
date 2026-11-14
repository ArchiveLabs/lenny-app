"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { CodeField, FIELD_HELP, FIELD_LABEL } from "@/components/code-field"
import { useGhostSettings } from "@/hooks/use-ghost-settings"
import { GHOST, readButtonHtml, readButtonUrl } from "@/lib/subscriptions"

/** How to put a Read button for a subscription book in a Ghost post; or the way to connect Ghost first. */
export function GhostReadButton({ olid, unsaved }: { olid: string; unsaved: boolean }) {
  const { t } = useTranslation()
  const { data, isLoading } = useGhostSettings()
  if (isLoading) return null
  if (!data?.site_url) {
    return (
      <div className="space-y-1">
        <p className={FIELD_LABEL}>{t("Connect your Ghost site first")}</p>
        <p className={FIELD_HELP}>
          {t("Members open this book from a Read button in your Ghost posts.")}{" "}
          <Link href={GHOST.route} className="font-medium text-foreground underline underline-offset-4">
            {t("Open Ghost settings")}
          </Link>
        </p>
      </div>
    )
  }
  const notes = [
    unsaved && t("Save changes first, or the button won't open this book."),
    !data.enabled && t("Ghost is turned off, so members can't read it until you turn Ghost back on."),
  ].filter(Boolean)
  return (
    <div className="space-y-4">
      <CodeField
        id="read-button-url"
        label={t("Read button: Button card link")}
        value={readButtonUrl(data.site_url, olid)}
        copyLabel={t("Copy Button card link")}
        help={t("In a Ghost post, add a Button card and paste this as its URL.")}
      />
      <CodeField
        id="read-button"
        label={t("Read button: HTML card code")}
        value={readButtonHtml(olid)}
        copyLabel={t("Copy HTML card code")}
        help={t("Or paste this into an HTML card.")}
      />
      {notes.length > 0 && <p className={FIELD_HELP}>{notes.join(" ")}</p>}
    </div>
  )
}
