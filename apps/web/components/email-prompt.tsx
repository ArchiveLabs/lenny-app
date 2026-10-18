"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Button } from "@workspace/ui/components/button"
import { EmailForm } from "@/components/email-form"
import { useMe } from "@/hooks/use-accounts"
import { ACCOUNT } from "@/lib/accounts"

const SEEN = "lenny-email-prompt-seen"
const seen = () => { try { return sessionStorage.getItem(SEEN) === "1" } catch { return false } }

/** Asks whoever has no email yet (the migrated super user) to add one, once per browser session. */
export function EmailPrompt() {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const [dismissed, setDismissed] = useState(seen)

  if (!me || me.email) return null
  const close = () => {
    try { sessionStorage.setItem(SEEN, "1") } catch { /* the prompt may come back; that's fine */ }
    setDismissed(true)
  }

  return (
    <Sheet open={!dismissed} onOpenChange={(open) => !open && close()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t(ACCOUNT.promptTitle)}</SheetTitle>
          <SheetDescription>{t(ACCOUNT.promptBody)}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <EmailForm id={me.id} email={null} onSaved={close} />
          <Button variant="ghost" onClick={close}>{t(ACCOUNT.promptLater)}</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
