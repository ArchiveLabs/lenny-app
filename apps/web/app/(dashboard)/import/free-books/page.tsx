"use client"

import { useTranslation } from "react-i18next"
import { BackLink } from "@/components/import/BackLink"
import { FreeBooks } from "@/components/preload/FreeBooks"

export default function FreeBooksPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4 p-2 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <BackLink label={t("Import & Redeem")} />
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("Free books")}</h1>
        <p className="text-muted-foreground">{t("Public-domain EPUBs from Standard Ebooks.")}</p>
      </div>
      <FreeBooks />
    </div>
  )
}
