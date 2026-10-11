"use client"

import { useTranslation } from "react-i18next"
import { BackLink } from "@/components/import/BackLink"
import { ImportTab } from "@/components/import/ImportTab"

export default function UploadPage() {
  const { t } = useTranslation()
  return (
    <div className="@container flex flex-col gap-6 p-2 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <BackLink label={t("Import & Redeem")} />
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("Upload Files from Computer")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("EPUB files only.")}</p>
      </div>
      <ImportTab />
    </div>
  )
}
