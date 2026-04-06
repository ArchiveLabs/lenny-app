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
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
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
                <span className="text-base font-semibold">Lenny Admin</span>
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
