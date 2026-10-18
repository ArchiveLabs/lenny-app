"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { z } from "zod"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { LIBRARIANS_KEY, ME_KEY, updateLibrarian, useFailure } from "@/hooks/use-accounts"
import { ACCOUNT } from "@/lib/accounts"

/** Saves the signed-in person's own email (PUT on their own row). Shared by the account page and the first-login prompt. */
export function EmailForm({ id, email, onSaved, secondary }: { id: number; email: string | null; onSaved?: () => void; secondary?: React.ReactNode }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fail = useFailure()
  const [value, setValue] = useState(email ?? "")
  const [error, setError] = useState("")

  const save = useMutation({
    mutationFn: (next: string) => updateLibrarian(id, { email: next }),
    onSuccess: () => {
      toast.success(t(ACCOUNT.emailSaved))
      void qc.invalidateQueries({ queryKey: ME_KEY })
      void qc.invalidateQueries({ queryKey: LIBRARIANS_KEY })
      onSaved?.()
    },
    onError: fail,
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = z.string().trim().email().safeParse(value)
    if (!parsed.success) return setError(t("Enter a valid email address."))
    setError("")
    save.mutate(parsed.data)
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="account-email">{t(ACCOUNT.emailLabel)}</Label>
        <Input
          id="account-email"
          type="email"
          autoComplete="email"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError("") }}
          aria-invalid={!!error}
          aria-describedby={error ? "account-email-error" : undefined}
        />
        {error && <p id="account-email-error" role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending || value.trim() === (email ?? "")}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          {t(ACCOUNT.save)}
        </Button>
        {secondary}
      </div>
    </form>
  )
}
