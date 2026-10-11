"use client"

import { useTranslation } from "react-i18next"
import { BackLink } from "@/components/import/BackLink"
import { MARKETPLACES } from "@/components/import/marketplaces"
import { SourceList } from "@/components/import/SourceList"

export default function MarketplacesPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6 p-2 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <BackLink label={t("Import & Redeem")} />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Marketplaces")}</h1>
        <p className="text-muted-foreground">{t("Choose a marketplace to redeem a bundle or code from.")}</p>
      </div>
      <SourceList sources={MARKETPLACES.map((m) => ({ ...m, title: t(m.title), description: t(m.description) }))} />
    </div>
  )
}
