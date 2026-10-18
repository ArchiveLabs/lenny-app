"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Loader2, Plus } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { FormField } from "@/components/form-field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { PasswordInput } from "@/components/password-input"
import { ErrorState } from "@/components/ErrorState"
import { UserAvatar } from "@/components/user-avatar"
import { LIBRARIANS_KEY, createLibrarian, setDisabled, updateLibrarian, useFailure, useLibrarians, useMe } from "@/hooks/use-accounts"
import { ACCOUNT, MIN_PASSWORD, NewPersonSchema, TEAM, fieldErrors } from "@/lib/accounts"
import { Librarian } from "@/types/api"

function AddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fail = useFailure()
  const [form, setForm] = useState({ username: "", email: "", password: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const add = useMutation({
    mutationFn: createLibrarian,
    onSuccess: (p) => {
      toast.success(t(TEAM.added(p.username)))
      void qc.invalidateQueries({ queryKey: LIBRARIANS_KEY })
      setForm({ username: "", email: "", password: "" })
      onOpenChange(false)
    },
    onError: fail,
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = NewPersonSchema.safeParse(form)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    add.mutate(parsed.data)
  }

  const field = (key: keyof typeof form, label: string, type: string, auto: string, extra: { hint?: string; ok?: string } = {}) => (
    <FormField id={`team-${key}`} label={t(label)} error={errors[key] && t(errors[key])} {...extra}>
      {(aria) => {
        const props = {
          ...aria,
          autoComplete: auto,
          value: form[key],
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: "" }) },
        }
        return type === "password" ? <PasswordInput {...props} /> : <Input type={type} {...props} />
      }}
    </FormField>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{t(TEAM.add)}</SheetTitle>
            <SheetDescription>{t(TEAM.addDescription)}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-4">
            {field("username", TEAM.username, "text", "off", { hint: t(TEAM.usernameHint) })}
            {field("email", TEAM.email, "email", "off")}
            {field("password", TEAM.password, "password", "new-password",
              form.password.length >= MIN_PASSWORD ? { ok: t(ACCOUNT.longEnough) } : { hint: t(ACCOUNT.lengthSoFar(form.password.length)) })}
          </div>
          <SheetFooter>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending && <Loader2 className="size-4 animate-spin" />}
              {t(TEAM.create)}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function Row({ person, isMe, onDisable }: { person: Librarian; isMe: boolean; onDisable: (p: Librarian) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fail = useFailure()
  const done = (message: string) => { toast.success(message); void qc.invalidateQueries({ queryKey: LIBRARIANS_KEY }) }

  const enable = useMutation({
    mutationFn: () => setDisabled(person.id, false),
    onSuccess: () => done(t(TEAM.enabled(person.username))),
    onError: fail,
  })
  const role = useMutation({
    mutationFn: () => updateLibrarian(person.id, { is_super: !person.is_super }),
    onSuccess: () => done(t(person.is_super ? TEAM.demoted(person.username) : TEAM.promoted(person.username))),
    onError: fail,
  })
  const busy = enable.isPending || role.isPending

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <UserAvatar username={person.username} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{person.username}</span>
          {isMe && <Badge variant="outline">{t(TEAM.you)}</Badge>}
          {person.is_super && <Badge variant="secondary">{t(ACCOUNT.roleSuper)}</Badge>}
          {person.disabled && <Badge variant="destructive">{t(TEAM.disabledBadge)}</Badge>}
        </div>
        <p className="truncate text-sm text-muted-foreground">{person.email ?? t(TEAM.noEmail)}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => role.mutate()}>
          {t(person.is_super ? TEAM.demote : TEAM.promote)}
        </Button>
        {person.disabled ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => enable.mutate()}>{t(TEAM.enable)}</Button>
        ) : (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onDisable(person)}>{t(TEAM.disable)}</Button>
        )}
      </div>
    </li>
  )
}

export default function TeamPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fail = useFailure()
  const { data: me, error: meError } = useMe()
  const { data, error, refetch } = useLibrarians(!!me?.is_super)
  const [adding, setAdding] = useState(false)
  const [target, setTarget] = useState<Librarian | null>(null)

  const disable = useMutation({
    mutationFn: (p: Librarian) => setDisabled(p.id, true),
    onSuccess: (_, p) => {
      toast.success(t(TEAM.disabled(p.username)))
      void qc.invalidateQueries({ queryKey: LIBRARIANS_KEY })
    },
    onError: fail,
  })

  if (meError || error) return <ErrorState error={(meError ?? error) as Error} onRetry={() => void refetch()} />
  if (!me) return <Skeleton className="h-64 w-full max-w-2xl" aria-busy="true" aria-label={t("Loading")} />
  // Only a courtesy: the server answers 403 to anyone but a super user.
  if (!me.is_super) return <ErrorState message={t("Only a super user can manage the team.")} />

  return (
    <div className="w-full min-w-0 max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(TEAM.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(TEAM.description)}</p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus className="size-4" />{t(TEAM.add)}</Button>
      </div>

      {!data ? (
        <Skeleton className="h-40 w-full" aria-busy="true" aria-label={t("Loading")} />
      ) : data.librarians.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(TEAM.empty)}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {data.librarians.map((p) => <Row key={p.id} person={p} isMe={p.id === me.id} onDisable={setTarget} />)}
        </ul>
      )}

      <AddSheet open={adding} onOpenChange={setAdding} />

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(TEAM.disableTitle(target?.username ?? ""))}</AlertDialogTitle>
            <AlertDialogDescription>{t(TEAM.disableBody)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => target && disable.mutate(target)}>{t(TEAM.disable)}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
