"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient } from "@/lib/query-client"
import { ChevronLeft, CheckCircle2, XCircle, AlertCircle, LogOut, PlugZap, Eye, EyeOff } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Separator } from "@workspace/ui/components/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { toast } from "sonner"

export default function OpenLibrarySettingsPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false)
  const [conflictUsername, setConflictUsername] = useState("")
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const statusQuery = useQuery({
    queryKey: ["admin_ol_status"],
    queryFn: async () => {
      const res = await fetch("/admin/api/admin/ol/status")
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(
          res.status === 401 || res.status === 403
            ? "Unauthorized: please log out and back in."
            : d.error || "Failed to fetch status"
        )
      }
      return res.json()
    },
  })

  const loginMutation = useMutation({
    mutationFn: async ({ replace = false }: { replace?: boolean }) => {
      const res = await fetch("/admin/api/admin/ol/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, replace }),
      })
      const data = await res.json()
      if (!res.ok) throw { status: res.status, data }
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message || "Connected successfully")
      setEmail("")
      setPassword("")
      setFormError(null)
      queryClient.invalidateQueries({ queryKey: ["admin_ol_status"] })
    },
    onError: (error: any) => {
      if (error.status === 409) {
        setConflictUsername(error.data.username)
        setReplaceDialogOpen(true)
        setFormError(null)
      } else if (error.status === 429) {
        setFormError("Too many attempts — please wait a few minutes before trying again.")
      } else if (error.status === 401) {
        setFormError("Incorrect email or password. Please check your Open Library or Internet Archive credentials.")
      } else {
        setFormError(error.data?.message || "Something went wrong. Please try again.")
      }
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/admin/api/admin/ol/logout", { method: "POST" })
      if (!res.ok) throw new Error("Logout failed")
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || "Disconnected")
      queryClient.invalidateQueries({ queryKey: ["admin_ol_status"] })
    },
    onError: () => toast.error("Failed to disconnect"),
  })

  const isConnected = statusQuery.data?.logged_in
  const connectedUser = statusQuery.data?.username

  return (
    <div className="max-w-2xl space-y-6">

      {/* Back */}
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Settings
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OpenLibrary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Authenticate with an OpenLibrary account to enable lending on this Lenny instance.
          </p>
        </div>

        {/* Status pill — only visible once we have data */}
        {!statusQuery.isLoading && !statusQuery.isError && (
          isConnected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400 whitespace-nowrap mt-1 shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground whitespace-nowrap mt-1 shrink-0">
              <XCircle className="h-3 w-3" />
              Not connected
            </span>
          )
        )}
      </div>

      <Separator />

      {/* Backend error */}
      {statusQuery.isError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-300">Cannot reach backend</p>
            <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">
              {statusQuery.error instanceof Error ? statusQuery.error.message : "Unknown error"}
            </p>
          </div>
        </div>
      )}

      {/* Connected state */}
      {isConnected && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-medium">Signed in as <span className="text-muted-foreground font-normal">{connectedUser}</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">Lending is active on this instance</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:border-red-900 dark:hover:bg-red-950/50 shrink-0"
            onClick={() => setDisconnectDialogOpen(true)}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            {logoutMutation.isPending ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
      )}

      {/* Login form — only when not connected */}
      {!statusQuery.isLoading && !isConnected && (
        <>
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-medium">Sign in to Open Library Account</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use your openlibrary.org credentials.
              </p>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); loginMutation.mutate({}) }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="ol-email">Email</Label>
                <Input
                  id="ol-email"
                  type="email"
                  placeholder="you@example.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="max-w-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ol-password">Password</Label>
                <div className="relative max-w-sm">
                  <Input
                    id="ol-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFormError(null) }}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Inline error */}
              {formError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50 px-3.5 py-3 text-sm max-w-sm">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-red-700 dark:text-red-300">{formError}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loginMutation.isPending || !!statusQuery.isError}
                className="gap-2"
              >
                <PlugZap className="h-4 w-4" />
                {loginMutation.isPending ? "Connecting…" : "Connect account"}
              </Button>
            </form>
          </section>
        </>
      )}

      {/* Disconnect dialog */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect OpenLibrary?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the OpenLibrary S3 keys from the server. Book lending will stop working until you reconnect with OpenLibrary.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { logoutMutation.mutate(); setDisconnectDialogOpen(false) }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Replace conflict dialog */}
      <AlertDialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Already connected</AlertDialogTitle>
            <AlertDialogDescription>
              Lenny is already signed in as <strong>{conflictUsername}</strong>. Replace with the new account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { loginMutation.mutate({ replace: true }); setReplaceDialogOpen(false) }}
            >
              Yes, replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
