"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Loader2, User, KeyRound, ShieldAlert } from "lucide-react"

export function LoginForm({
  className,
  redirectTo = "/",
  ...props
}: React.ComponentProps<"div"> & { redirectTo?: string }) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const res = await fetch("/admin/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        router.push(redirectTo)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Invalid credentials. Please try again.")
      }
    } catch {
      setError("Unable to reach authentication service.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="shadow-xl border-border/60">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <img
              src="/admin/lenny-transparent.png"
              alt="Lenny"
              className="h-20 w-20 mx-auto drop-shadow-md"
            />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Lenny Admin</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in with your admin credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-5">
              <div className="space-y-2.5">
                <Label htmlFor="username" className="text-sm font-semibold flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError("") }}
                  required
                  autoFocus
                  autoComplete="username"
                  className="h-12 text-base rounded-xl bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="password" className="text-sm font-semibold flex items-center gap-2">
                  <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError("") }}
                  required
                  autoComplete="current-password"
                  className="h-12 text-base rounded-xl bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/30"
                />
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full h-12 text-base font-bold rounded-xl shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Authenticating…
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground pt-1">
                Contact your service provider or administrator for access credentials.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
