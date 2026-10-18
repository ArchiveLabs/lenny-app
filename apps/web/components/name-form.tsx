"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { FormField } from "@/components/form-field"
import { LIBRARIANS_KEY, ME_KEY, updateLibrarian, useFailure } from "@/hooks/use-accounts"
import { ACCOUNT, NameSchema } from "@/lib/accounts"

/** Saves the signed-in person's own name (PUT on their own row). */
export function NameForm({ id, name }: { id: number; name: string | null }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fail = useFailure()
  const [value, setValue] = useState(name ?? "")
  const [error, setError] = useState("")

  const save = useMutation({
    mutationFn: (next: string) => updateLibrarian(id, { name: next }),
    onSuccess: () => {
      toast.success(t(ACCOUNT.nameSaved))
      void qc.invalidateQueries({ queryKey: ME_KEY })
      void qc.invalidateQueries({ queryKey: LIBRARIANS_KEY })
    },
    onError: fail,
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = NameSchema.safeParse(value)
    if (!parsed.success) return setError(t(parsed.error.issues[0]!.message))
    setError("")
    save.mutate(parsed.data)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <FormField id="account-name" label={t(ACCOUNT.nameLabel)} error={error}>
        {(aria) => <Input {...aria} autoComplete="name" value={value} onChange={(e) => { setValue(e.target.value); setError("") }} />}
      </FormField>
      <Button type="submit" disabled={save.isPending || value.trim() === (name ?? "")}>
        {save.isPending && <Loader2 className="size-4 animate-spin" />}
        {t(ACCOUNT.save)}
      </Button>
    </form>
  )
}
