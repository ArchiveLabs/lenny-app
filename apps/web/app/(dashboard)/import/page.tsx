"use client"

import { BookOpen, Search, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SourceList } from "@/components/import/SourceList"

export default function ImportHub() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-10 p-2 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight sm:text-3xl">{t("Import")}</h1>
          <p className="text-muted-foreground">{t("Add EPUB files from your computer, or pick free books.")}</p>
        </div>
        <SourceList
          sources={[
            {
              title: t("Upload Files from Computer"),
              description: t("Drop a folder or many EPUBs. Books are matched to Open Library and reviewed before they are imported."),
              href: "/import/upload",
              icon: <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />,
            },
            {
              title: t("Free books"),
              description: t("Pick from public-domain Standard Ebooks and add them to your library."),
              href: "/import/free-books",
              icon: <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden />,
            },
          ]}
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight sm:text-3xl">{t("Redeem")}</h2>
          <p className="text-muted-foreground">{t("Choose a source to redeem a bundle or code from.")}</p>
        </div>
        <SourceList
          sources={[
            {
              title: t("Redeem from BRIET Marketplace"),
              description: t("Redeem a BRIET bundle code to import every book it contains."),
              href: "/import/briet",
              // eslint-disable-next-line @next/next/no-img-element
              icon: <img src="/admin/briet-logo.svg" alt="" className="h-full w-full object-contain" />,
            },
            {
              title: t("Search all Marketplaces..."),
              description: t("Browse every marketplace you can redeem from."),
              href: "/import/marketplaces",
              icon: <Search className="h-5 w-5 text-muted-foreground" aria-hidden />,
            },
          ]}
        />
      </section>
    </div>
  )
}
