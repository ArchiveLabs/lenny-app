"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { ImportTab } from "@/components/import/ImportTab"
import { RedeemTab } from "@/components/import/RedeemTab"

function ImportPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const tab = useSearchParams().get("tab") === "redeem" ? "redeem" : "import"

  return (
    <div className="@container flex flex-col gap-6 p-2 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("Import & Redeem")}</h1>
        <p className="text-muted-foreground max-w-2xl">
          {t("Add EPUB files from your computer, or redeem a bundle code.")}
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => router.replace(v === "redeem" ? "/import?tab=redeem" : "/import")}>
        <TabsList>
          <TabsTrigger value="import">{t("Import")}</TabsTrigger>
          <TabsTrigger value="redeem">{t("Redeem")}</TabsTrigger>
        </TabsList>
        <TabsContent value="import" className="mt-6">
          <ImportTab />
        </TabsContent>
        <TabsContent value="redeem" className="mt-6">
          <RedeemTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <ImportPage />
    </Suspense>
  )
}
