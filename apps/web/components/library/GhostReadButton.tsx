"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { CodeField, FIELD_HELP, FIELD_LABEL } from "@/components/code-field"
import { useGhostSettings } from "@/hooks/use-ghost-settings"
import { GHOST, readButtonHtml } from "@/lib/subscriptions"

/** The Read button to paste into a Ghost post, for a subscription book; or the way to connect Ghost first. */
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
  return (
    <CodeField
      id="read-button"
      label={t("Read button for a Ghost post")}
      value={readButtonHtml(olid)}
      copyLabel={t("Copy Read button")}
      help={[
        unsaved ? t("Save changes first, then paste it into an HTML card in a Ghost post.") : t("Paste it into an HTML card in a Ghost post."),
        !data.enabled && t("Ghost is turned off, so members can't read it until you turn Ghost back on."),
      ].filter(Boolean).join(" ")}
    />
  )
}
