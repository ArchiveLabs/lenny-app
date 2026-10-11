"use client"

import { type Icon } from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

/** The page you are on, or one inside it: /import/upload is inside Import & Redeem. */
export const isCurrent = (pathname: string | null, url: string) =>
  !!pathname && url.startsWith("/") && (pathname === url || pathname.startsWith(`${url}/`))

/** Every row is the same height, with room around the icon and the label, and the current page is highlighted. */
export const NAV_ITEM = "h-10 gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground data-[active=true]:text-sidebar-accent-foreground [&>svg]:size-[18px]"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {
  const pathname = usePathname()
  return (
    <SidebarGroup className="px-3 py-2">
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title} asChild isActive={isCurrent(pathname, item.url)} className={NAV_ITEM}>
                <Link href={item.url} aria-current={isCurrent(pathname, item.url) ? "page" : undefined}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
