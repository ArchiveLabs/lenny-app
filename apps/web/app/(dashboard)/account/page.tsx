"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { PasswordInput } from "@/components/password-input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { EmailForm } from "@/components/email-form"
import { ErrorState } from "@/components/ErrorState"
import { UserAvatar } from "@/components/user-avatar"
import { updateLibrarian, useFailure, useMe } from "@/hooks/use-accounts"
import { ACCOUNT, MIN_PASSWORD, TEAM } from "@/lib/accounts"

function PasswordForm({ id }: { id: number }) {
  const { t } = useTranslation()
  const fail = useFailure()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [again, setAgain] = useState("")
  const [error, setError] = useState("")

  const save = useMutation({
    mutationFn: () => updateLibrarian(id, { password: next, current_password: current }),
    onSuccess: () => {
      toast.success(t(ACCOUNT.passwordSaved))
      setCurrent(""); setNext(""); setAgain("")
    },
    onError: fail,
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < MIN_PASSWORD) return setError(t(ACCOUNT.passwordShort))
    if (next !== again) return setError(t(ACCOUNT.passwordMismatch))
    setError("")
    save.mutate()
  }

  const field = (key: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{t(label)}</Label>
      <PasswordInput id={key} autoComplete={auto} value={value} onChange={(e) => { set(e.target.value); setError("") }} required />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-3">
      {field("current-password", ACCOUNT.currentPassword, current, setCurrent, "current-password")}
      {field("new-password", ACCOUNT.newPassword, next, setNext, "new-password")}
      {field("repeat-password", ACCOUNT.confirmPassword, again, setAgain, "new-password")}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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
