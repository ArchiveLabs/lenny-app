"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@workspace/ui/components/input"
import { ACCOUNT } from "@/lib/accounts"

/** A password field with a show/hide toggle, for forms where a typo is costly. */
export function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={t(shown ? ACCOUNT.hide : ACCOUNT.show)}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
