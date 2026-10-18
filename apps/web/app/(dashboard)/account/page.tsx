"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { PasswordInput, PasswordRules } from "@/components/password-input"
import { FormField } from "@/components/form-field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { EmailForm } from "@/components/email-form"
import { ErrorState } from "@/components/ErrorState"
import { UserAvatar } from "@/components/user-avatar"
import { updateLibrarian, useFailure, useMe } from "@/hooks/use-accounts"
import { ACCOUNT, ChangePasswordSchema, TEAM, fieldErrors } from "@/lib/accounts"

function PasswordForm({ id }: { id: number }) {
  const { t } = useTranslation()
  const fail = useFailure()
  const [values, setValues] = useState({ current: "", next: "", again: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: () => updateLibrarian(id, { password: values.next, current_password: values.current }),
    onSuccess: () => {
      toast.success(t(ACCOUNT.passwordSaved))
      setValues({ current: "", next: "", again: "" })
    },
    onError: fail,
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = ChangePasswordSchema.safeParse(values)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    save.mutate()
  }

  const field = (key: keyof typeof values, label: string, auto: string, extra: { hint?: React.ReactNode; ok?: string } = {}) => (
    <FormField id={`password-${key}`} label={t(label)} error={errors[key] && t(errors[key])} {...extra}>
      {(aria) => (
        <PasswordInput
          {...aria}
          autoComplete={auto}
          value={values[key]}
          onChange={(e) => { setValues({ ...values, [key]: e.target.value }); setErrors({ ...errors, [key]: "" }) }}
        />
      )}
    </FormField>
  )

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {field("current", ACCOUNT.currentPassword, "current-password")}
      {field("next", ACCOUNT.newPassword, "new-password",
        { hint: <PasswordRules value={values.next} /> })}
      {field("again", ACCOUNT.confirmPassword, "new-password",
        values.again && values.again === values.next ? { ok: t(ACCOUNT.matches) } : {})}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending && <Loader2 className="size-4 animate-spin" />}
        {t(ACCOUNT.passwordTitle)}
      </Button>
    </form>
  )
}

export default function AccountPage() {
  const { t } = useTranslation()
  const { data: me, error, refetch } = useMe()

  if (error) return <ErrorState error={error as Error} onRetry={() => void refetch()} />
  if (!me) return <Skeleton className="h-64 w-full max-w-2xl" aria-busy="true" aria-label={t("Loading")} />

  const joined = new Date(me.created_at)
  const joinedText = Number.isNaN(joined.getTime()) ? "" : joined.toLocaleDateString(undefined, { dateStyle: "long" })

  return (
    <div className="w-full min-w-0 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t(ACCOUNT.title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(ACCOUNT.description)}</p>
      </div>

      <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <UserAvatar username={me.username} size={64} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{me.username}</h2>
            <Badge variant="secondary">{me.is_super ? t(ACCOUNT.roleSuper) : t(ACCOUNT.roleLibrarian)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{me.is_super ? t(ACCOUNT.roleSuperHelp) : t(ACCOUNT.roleLibrarianHelp)}</p>
          {joinedText && <p className="text-xs text-muted-foreground">{t(ACCOUNT.joined(joinedText))}</p>}
        </div>
        {me.is_super && (
          <Button asChild variant="outline" size="sm"><Link href={TEAM.route}>{t(ACCOUNT.manageTeam)}</Link></Button>
        )}
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div>
          <h2 className="text-base font-semibold">{t(ACCOUNT.emailTitle)}</h2>
          <p className="text-sm text-muted-foreground">{t(ACCOUNT.emailHelp)}</p>
        </div>
        <EmailForm key={me.email ?? ""} id={me.id} email={me.email} />
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div>
          <h2 className="text-base font-semibold">{t(ACCOUNT.passwordTitle)}</h2>
          <p className="text-sm text-muted-foreground">{t(ACCOUNT.passwordHelp)}</p>
        </div>
        <PasswordForm id={me.id} />
      </section>
    </div>
  )
}
