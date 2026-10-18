"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { EmailForm } from "@/components/email-form"
import { ErrorState } from "@/components/ErrorState"
import { UserAvatar } from "@/components/user-avatar"
import { updateLibrarian, useFailure, useMe } from "@/hooks/use-accounts"
import { ACCOUNT, MIN_PASSWORD } from "@/lib/accounts"

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
      <Input id={key} type="password" autoComplete={auto} value={value} onChange={(e) => { set(e.target.value); setError("") }} required />
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

  return (
    <div className="w-full min-w-0 max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <UserAvatar username={me.username} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{me.username}</h1>
          <Badge variant="secondary" className="mt-1">{me.is_super ? t(ACCOUNT.roleSuper) : t(ACCOUNT.roleLibrarian)}</Badge>
        </div>
      </div>
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <EmailForm key={me.email ?? ""} id={me.id} email={me.email} />
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-base font-semibold">{t(ACCOUNT.passwordTitle)}</h2>
        <PasswordForm id={me.id} />
      </section>
    </div>
  )
}
