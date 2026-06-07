"use client"

import * as React from "react"
import {
  IconHelp,
  IconSearch,
  IconSettings,
  IconBook,
  IconUpload,
  IconServer,
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

const data = {
  navMain: [
    {
      title: "Add Open Library Book",
      url: "/add-book",
      icon: IconSearch,
    },
    {
      title: "Upload EPUB",
      url: "/",
      icon: IconUpload,
    },
    {
      title: "Processing Queue",
      url: "/processing",
      icon: IconServer,
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
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <div className="flex h-6 w-6 items-center justify-center p-0.5 rounded-sm bg-white dark:bg-black overflow-hidden ring-1 ring-border">
                  <img src="/admin/lenny-transparent.png" className="w-full h-full object-contain" alt="Lenny Admin" />
                </div>
                <span className="text-base font-semibold">{t("Lenny Admin")}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
