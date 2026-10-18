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
import { PasswordInput, PasswordRules } from "@/components/password-input"
import { CopyButton } from "@/components/copy-button"
import { ErrorState } from "@/components/ErrorState"
import { UserAvatar } from "@/components/user-avatar"
import { LIBRARIANS_KEY, createLibrarian, setDisabled, updateLibrarian, useFailure, useLibrarians, useMe } from "@/hooks/use-accounts"
import { ACCOUNT, NewPersonSchema, TEAM, displayName, fieldErrors, generatePassword } from "@/lib/accounts"
import { ApiError, Librarian } from "@/types/api"

function AddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fail = useFailure()
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Bumped on each Generate so the password field remounts already revealed.
  const [generations, setGenerations] = useState(0)
  // Held only while this sheet is open: the password can't be shown again after it closes.
  const [created, setCreated] = useState<{ name: string; username: string; email: string; password: string } | null>(null)

  const add = useMutation({
    mutationFn: createLibrarian,
    onSuccess: (p, vars) => {
      toast.success(t(TEAM.added(displayName(p))))
      void qc.invalidateQueries({ queryKey: LIBRARIANS_KEY })
      setCreated({ name: displayName(p), username: p.username, email: vars.email, password: vars.password })
      setForm({ name: "", email: "", password: "" })
      setGenerations(0)
    },
    onError: fail,
  })

  const finish = () => { setCreated(null); onOpenChange(false) }
  const generate = () => {
    setForm({ ...form, password: generatePassword() })
    setErrors({ ...errors, password: "" })
    setGenerations(generations + 1)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = NewPersonSchema.safeParse(form)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    add.mutate(parsed.data)
  }

  const field = (key: keyof typeof form, label: string, type: string, auto: string, extra: { hint?: React.ReactNode; ok?: string } = {}) => (
    <FormField id={`team-${key}`} label={t(label)} error={errors[key] && t(errors[key])} {...extra}>
      {(aria) => {
        const props = {
          ...aria,
          autoComplete: auto,
          value: form[key],
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: "" }) },
        }
        return type === "password" ? <PasswordInput key={generations} defaultShown={generations > 0} {...props} /> : <Input type={type} {...props} />
      }}
    </FormField>
  )

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : finish())}>
      <SheetContent className="sm:max-w-md">
        {created ? (
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>{t(TEAM.sharedTitle(created.name))}</SheetTitle>
              <SheetDescription>{t(TEAM.sharedBody)}</SheetDescription>
            </SheetHeader>
            <dl className="flex-1 space-y-4 px-4 text-sm">
              <div><dt className="text-muted-foreground">{t(TEAM.email)}</dt><dd className="font-medium">{created.email}</dd></div>
              <div><dt className="text-muted-foreground">{t(TEAM.username)}</dt><dd className="font-medium">{created.username}</dd></div>
              <div>
                <dt className="text-muted-foreground">{t(TEAM.password)}</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 font-mono">{created.password}</code>
                  <CopyButton value={created.password} />
                </dd>
              </div>
            </dl>
            <SheetFooter><Button onClick={finish}>{t(TEAM.done)}</Button></SheetFooter>
          </div>
        ) : (
        <form onSubmit={submit} noValidate className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{t(TEAM.add)}</SheetTitle>
            <SheetDescription>{t(TEAM.addDescription)}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-4">
            {field("name", TEAM.name, "text", "off")}
            {field("email", TEAM.email, "email", "off", { hint: t(TEAM.signIn) })}
            {field("password", TEAM.password, "password", "new-password",
              { hint: <><PasswordRules value={form.password} />{generations > 0 && <p className="mt-2">{t(TEAM.generated)}</p>}</> })}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={generate}>{t(TEAM.generate)}</Button>
              <CopyButton value={form.password} />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending && <Loader2 className="size-4 animate-spin" />}
              {t(TEAM.create)}
            </Button>
          </SheetFooter>
        </form>
        )}
      </SheetContent>
    </Sheet>
  )
}

function RoleSheet({ person, onClose }: { person: Librarian | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fail = useFailure()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const promoting = !person?.is_super

  const change = useMutation({
    mutationFn: (p: Librarian) => updateLibrarian(p.id, { is_super: !p.is_super, current_password: password }),
    onSuccess: (_, p) => {
      toast.success(t(p.is_super ? TEAM.demoted(displayName(p)) : TEAM.promoted(displayName(p))))
      void qc.invalidateQueries({ queryKey: LIBRARIANS_KEY })
      close()
    },
    // A wrong password is the person's to fix, so it stays in the form; everything else is a toast.
    onError: (e) => (e instanceof ApiError && e.status === 400 ? setError(e.message) : fail(e)),
  })

  const close = () => { setPassword(""); setError(""); onClose() }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!person) return
    if (!password) return setError(t("Enter your password."))
    setError("")
    change.mutate(person)
  }
  const title = !person ? "" : promoting ? TEAM.promoteTitle(displayName(person)) : TEAM.demoteTitle(displayName(person))
  const body = promoting ? TEAM.promoteBody : TEAM.demoteBody

  return (
    <Sheet open={!!person} onOpenChange={(o) => !o && close()}>
      <SheetContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{t(title)}</SheetTitle>
            <SheetDescription>{t(body)}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 px-4">
            <FormField id="role-password" label={t(TEAM.confirmPassword)} hint={t(TEAM.confirmPasswordHelp)} error={error}>
              {(aria) => (
                <PasswordInput {...aria} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError("") }} />
              )}
            </FormField>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={change.isPending}>
              {change.isPending && <Loader2 className="size-4 animate-spin" />}
              {t(TEAM.confirm)}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function Row({ person, isMe, onDisable, onRole }: { person: Librarian; isMe: boolean; onDisable: (p: Librarian) => void; onRole: (p: Librarian) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fail = useFailure()
  const done = (message: string) => { toast.success(message); void qc.invalidateQueries({ queryKey: LIBRARIANS_KEY }) }

  const enable = useMutation({
    mutationFn: () => setDisabled(person.id, false),
    onSuccess: () => done(t(TEAM.enabled(displayName(person)))),
    onError: fail,
  })
  const busy = enable.isPending

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <UserAvatar seed={String(person.id)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{displayName(person)}</span>
          {isMe && <Badge variant="outline">{t(TEAM.you)}</Badge>}
          {person.is_super && <Badge variant="secondary">{t(ACCOUNT.roleSuper)}</Badge>}
          {person.disabled && <Badge variant="destructive">{t(TEAM.disabledBadge)}</Badge>}
        </div>
        <p className="truncate text-sm text-muted-foreground">{person.username} · {person.email ?? t(TEAM.noEmail)}</p>
      </div>
      <div className="flex gap-2">
        {/* The server refuses to disable you or change your own super status, so your row has no actions. */}
        {isMe ? null : <Button variant="outline" size="sm" disabled={busy} onClick={() => onRole(person)}>
          {t(person.is_super ? TEAM.demote : TEAM.promote)}
        </Button>}
        {isMe ? null : person.disabled ? (
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
  const [roleTarget, setRoleTarget] = useState<Librarian | null>(null)

  const disable = useMutation({
    mutationFn: (p: Librarian) => setDisabled(p.id, true),
    onSuccess: (_, p) => {
      toast.success(t(TEAM.disabled(displayName(p))))
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
          {data.librarians.map((p) => <Row key={p.id} person={p} isMe={p.id === me.id} onDisable={setTarget} onRole={setRoleTarget} />)}
        </ul>
      )}

      <AddSheet open={adding} onOpenChange={setAdding} />
      <RoleSheet person={roleTarget} onClose={() => setRoleTarget(null)} />

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(TEAM.disableTitle(target ? displayName(target) : ""))}</AlertDialogTitle>
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
