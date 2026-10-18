"use client"

import * as React from "react"
import {
  IconHelp,
  IconSettings,
  IconBook,
  IconUpload,
  IconServer,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { useTranslation } from "react-i18next"
import { useMe } from "@/hooks/use-accounts"
import { ACCOUNT, TEAM } from "@/lib/accounts"

const data = {
  navMain: [
    {
      title: "Import & Redeem",
      url: "/import",
      icon: IconUpload,
    },
    {
      title: "Lenny Library",
      url: "/library",
      icon: IconBook,
    },
    {
      title: "Active Loans",
      url: "/loans",
      icon: IconServer, // Actually maybe replace this icon, but IconServer or IconBook is fine. I'll use IconBook or import a better one.
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const { data: me } = useMe()
  // Hiding is only a courtesy: the server answers 403 to anyone but a super user.
  const navSecondary = [
    ...data.navSecondary.slice(0, 1),
    { title: ACCOUNT.title, url: ACCOUNT.route, icon: IconUser },
    ...(me?.is_super ? [{ title: TEAM.title, url: TEAM.route, icon: IconUsers }] : []),
    ...data.navSecondary.slice(1),
  ]
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="px-4 pt-4 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-11 gap-3 rounded-lg px-1.5">
              <a href="/admin" aria-label={t("Lenny Admin")}>
                <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-border dark:bg-black">
                  <img src="/admin/lenny-transparent.png" className="h-full w-full object-contain" alt="" />
                </div>
                <span className="text-base font-semibold tracking-tight">{t("Lenny Admin")}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter className="border-t px-3 py-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
