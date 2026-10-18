"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { z } from "zod"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { FormField } from "@/components/form-field"
import { LIBRARIANS_KEY, ME_KEY, updateLibrarian, useFailure } from "@/hooks/use-accounts"
import { ACCOUNT, EmailSchema, NameSchema, fieldErrors } from "@/lib/accounts"

const ProfileSchema = z.object({ name: NameSchema, email: EmailSchema })

/** Name and email in one form, saved with one PUT that carries only what changed. */
export function ProfileForm({ id, name, email }: { id: number; name: string | null; email: string | null }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fail = useFailure()
  const [values, setValues] = useState({ name: name ?? "", email: email ?? "" })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: (changes: { name?: string; email?: string }) => updateLibrarian(id, changes),
    onSuccess: () => {
      toast.success(t(ACCOUNT.profileSaved))
      void qc.invalidateQueries({ queryKey: ME_KEY })
      void qc.invalidateQueries({ queryKey: LIBRARIANS_KEY })
    },
    onError: fail,
  })

  const dirty = values.name.trim() !== (name ?? "") || values.email.trim() !== (email ?? "")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = ProfileSchema.safeParse(values)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    save.mutate({
      ...(parsed.data.name !== (name ?? "") && { name: parsed.data.name }),
      ...(parsed.data.email !== (email ?? "") && { email: parsed.data.email }),
    })
  }

  const field = (key: "name" | "email", label: string, auto: string) => (
    <FormField id={`account-${key}`} label={t(label)} error={errors[key] && t(errors[key])}>
      {(aria) => (
        <Input
          {...aria}
          type={key === "email" ? "email" : "text"}
          autoComplete={auto}
          value={values[key]}
          onChange={(e) => { setValues({ ...values, [key]: e.target.value }); setErrors({ ...errors, [key]: "" }) }}
        />
      )}
    </FormField>
  )

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {field("name", ACCOUNT.nameLabel, "name")}
      {field("email", ACCOUNT.emailLabel, "email")}
      <Button type="submit" disabled={save.isPending || !dirty}>
        {save.isPending && <Loader2 className="size-4 animate-spin" />}
        {t(ACCOUNT.save)}
      </Button>
    </form>
  )
}
