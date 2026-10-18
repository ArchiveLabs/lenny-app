"use client"

import { useState } from "react"
import { Check, Circle, Eye, EyeOff } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@workspace/ui/components/input"
import { ACCOUNT, PASSWORD_RULES } from "@/lib/accounts"

/** A password field with a show/hide toggle, for forms where a typo is costly. */
export function PasswordInput({ defaultShown = false, ...props }: Omit<React.ComponentProps<typeof Input>, "type"> & { defaultShown?: boolean }) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(defaultShown)
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

/** What a new password needs, ticked off as it is typed. */
export function PasswordRules({ value }: { value: string }) {
  const { t } = useTranslation()
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      {PASSWORD_RULES.map((r) => {
        const ok = r.ok(value)
        return (
          <li key={r.key} className={ok ? "flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400" : "flex items-center gap-1.5"}>
            {ok ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Circle className="size-2.5 shrink-0 mx-px" aria-hidden />}
            <span>{t(r.label)}</span>
            <span className="sr-only">{ok ? t("done") : t("not yet")}</span>
          </li>
        )
      })}
    </ul>
  )
}
