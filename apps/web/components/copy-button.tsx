"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { copyText } from "@/lib/library/share"
import { TEAM } from "@/lib/accounts"

/** Copies `value` and says so on the button itself: nothing about the value goes in a toast or the console. */
export function CopyButton({ value, label = TEAM.copy }: { value: string; label?: string }) {
  const { t } = useTranslation()
  const [state, setState] = useState<"idle" | "copied" | "blocked">("idle")

  useEffect(() => {
    if (state === "idle") return
    const id = setTimeout(() => setState("idle"), 2000)
    return () => clearTimeout(id)
  }, [state])

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!value}
      onClick={async () => setState((await copyText(value)) === "copied" ? "copied" : "blocked")}
    >
      {state === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />}
      {t(state === "copied" ? TEAM.copied : state === "blocked" ? TEAM.copyBlocked : label)}
    </Button>
  )
}
