"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Loader2, ShieldAlert } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { FormField } from "@/components/form-field"
import { PasswordInput } from "@/components/password-input"
import { fieldErrors } from "@/lib/accounts"

const LOGIN = {
  title: "Sign in to Lenny",
  description: "Manage your library.",
  username: "Email or username",
  password: "Password",
  submit: "Sign in",
  submitting: "Signing in…",
  noAccount: "New here? Ask a super user on your team to add you.",
  usernameMissing: "Enter your email or username.",
  passwordMissing: "Enter your password.",
  failed: "Couldn't sign in. Try again.",
  unreachable: "Couldn't reach the server. Check your connection and try again.",
} as const

const LoginSchema = z.object({
  username: z.string().trim().min(1, LOGIN.usernameMissing),
  password: z.string().min(1, LOGIN.passwordMissing),
})

export function LoginForm({
  className,
  redirectTo = "/",
  ...props
}: React.ComponentProps<"div"> & { redirectTo?: string }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [values, setValues] = useState({ username: "", password: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const change = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues({ ...values, [key]: e.target.value })
    setErrors({ ...errors, [key]: "" })
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = LoginSchema.safeParse(values)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setError("")
    setIsLoading(true)
    try {
      const res = await fetch("/admin/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      if (res.ok) {
        router.push(redirectTo)
        router.refresh()
        return // keep the button busy until the next page loads
      }
      const data = await res.json().catch(() => ({}))
      setError(typeof data.error === "string" && data.error ? data.error : LOGIN.failed)
    } catch {
      setError(LOGIN.unreachable)
    }
    setIsLoading(false)
  }

  return (
    <div className={cn("flex flex-col gap-8", className)} {...props}>
      <header className="space-y-1.5 text-center lg:text-left">
        {/* The brand panel shows the logo from lg up. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/admin/lenny-transparent.png" alt="" className="mx-auto mb-4 size-14 object-contain lg:hidden" />
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">{t(LOGIN.title)}</h1>
          <p className="text-sm text-muted-foreground">{t(LOGIN.description)}</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField id="username" label={t(LOGIN.username)} required={false} error={errors.username && t(errors.username)}>
          {(aria) => (
            <Input
              {...aria}
              value={values.username}
              onChange={change("username")}
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </FormField>
        <FormField id="password" label={t(LOGIN.password)} required={false} error={errors.password && t(errors.password)}>
          {(aria) => (
            <PasswordInput {...aria} value={values.password} onChange={change("password")} autoComplete="current-password" />
          )}
        </FormField>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t(error)}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading && <Loader2 className="size-4 animate-spin" />}
          {t(isLoading ? LOGIN.submitting : LOGIN.submit)}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground lg:text-left">{t(LOGIN.noAccount)}</p>
    </div>
  )
}
