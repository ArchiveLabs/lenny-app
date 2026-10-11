"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { useTranslation } from "react-i18next"
import { crumbsFor } from "@/lib/breadcrumbs"

export function SiteHeader() {
  const { t } = useTranslation()
  const crumbs = crumbsFor(usePathname() ?? "")
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.length === 0 ? (
              <BreadcrumbItem>
                <BreadcrumbPage>{t("Lenny Dashboard")}</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              crumbs.map((c, i) => (
                <Fragment key={c.href}>
                  {i > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
                  <BreadcrumbItem className={i < crumbs.length - 1 ? "hidden sm:inline-flex" : "min-w-0"}>
                    {i === crumbs.length - 1 ? (
                      <BreadcrumbPage className="truncate text-base font-medium">{t(c.label)}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={c.href}>{t(c.label)}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
