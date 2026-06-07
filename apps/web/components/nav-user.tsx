"use client"

import { useEffect, useState } from "react"
import { IconLogout } from "@tabler/icons-react"
import {
  Avatar,
  AvatarFallback,
} from "@workspace/ui/components/avatar"
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { useTranslation } from "react-i18next"

function getCookieValue(name: string): string {
  if (typeof document === "undefined") return ""
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`))
  return match ? decodeURIComponent(match[1]!) : ""
}

function initials(username: string): string {
  return username.slice(0, 2).toUpperCase() || "??"
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const [username, setUsername] = useState("")
  const { t } = useTranslation()

  useEffect(() => {
    setUsername(getCookieValue("admin_user"))
  }, [])

  const handleLogout = async () => {
    try {
      const res = await fetch("/admin/api/auth/logout", { method: "POST" })
      if (!res.ok) console.error("Logout failed:", res.status)
    } catch (err) {
      console.error("Logout request failed:", err)
    }
    window.location.href = "/admin/login"
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center gap-2 px-1">
            <Avatar className="h-8 w-8 rounded-lg grayscale">
              <AvatarFallback className="rounded-lg">{initials(username)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{username || "Admin"}</span>
              <span className="text-xs text-muted-foreground">{t("Administrator")}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full rounded-md bg-muted/50 hover:bg-muted px-2 py-1.5 text-sm font-medium transition-colors text-red-600 dark:text-red-400 border border-transparent hover:border-red-500/20"
          >
            <IconLogout className="size-4" />
            {t("Log out")}
          </button>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
