"use client"

import { useTranslation } from "react-i18next"
import { BackLink } from "@/components/import/BackLink"
import { BrietRedeem } from "@/components/import/BrietRedeem"

export default function BrietPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6 p-2 md:p-6 lg:p-8">
      <BackLink label={t("Import & Redeem")} />
      <BrietRedeem />
    </div>
  )
}
