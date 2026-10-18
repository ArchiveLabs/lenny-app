"use client"

import { useEffect, useState } from "react"
import { IconLogout } from "@tabler/icons-react"
import Link from "next/link"
import {
  SidebarMenu,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { useTranslation } from "react-i18next"
import { UserAvatar } from "@/components/user-avatar"
import { useMe } from "@/hooks/use-accounts"
import { ACCOUNT } from "@/lib/accounts"

function getCookieValue(name: string): string {
  if (typeof document === "undefined") return ""
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`))
  return match ? decodeURIComponent(match[1]!) : ""
}

export function NavUser() {
  const [username, setUsername] = useState("")
  const { t } = useTranslation()
  const { data: me } = useMe()
  const name = me?.username || username

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
          <Link href={ACCOUNT.route} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg" aria-label={t(ACCOUNT.title)}>
            <UserAvatar username={name} />
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name || "Admin"}</span>
              <span className="truncate text-xs text-muted-foreground">
                {me?.is_super ? t(ACCOUNT.roleSuper) : me ? t(ACCOUNT.roleLibrarian) : t("Administrator")}
              </span>
            </div>
          </Link>
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
