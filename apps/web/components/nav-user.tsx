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
        {/* One row: who you are, and a quiet way out. */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <Avatar className="size-9 rounded-lg">
            <AvatarFallback className="rounded-lg text-xs font-semibold">{initials(username)}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{username || "Admin"}</span>
            <span className="truncate text-xs text-muted-foreground">{t("Administrator")}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label={t("Log out")}
            title={t("Log out")}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          >
            <IconLogout className="size-[18px]" />
          </button>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
