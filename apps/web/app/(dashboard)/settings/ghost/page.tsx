"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleCheck, CircleDashed, Info, Loader2, RefreshCw, Unplug } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { CopyButton } from "@/components/copy-button"
import { ErrorState } from "@/components/ErrorState"
import { NativeSelect } from "@/components/NativeSelect"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { relativeTime } from "@/lib/preload/time"
import { ACCESS_MODES, GHOST, SUBSCRIPTIONS_DOC, WEBHOOKS_DOC } from "@/lib/subscriptions"
import { AccessMode, ApiError, GhostSettings, GhostSettingsSchema } from "@/types/api"

const KEY = ["ghost-settings"]

export default function GhostSettingsPage() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: async () => handleApiResponse<GhostSettings>(await fetchAdmin("settings/ghost"), GhostSettingsSchema),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
  if (!data) {
    const unsupported = error instanceof ApiError && error.status === 404
    return (
      <ErrorState
        message={unsupported ? t("This Lenny server doesn't support Ghost yet. Update Lenny, then reload this page.") : error?.message || t("Couldn't load the Ghost settings.")}
      />
    )
  }
  return <GhostForm settings={data} />
}

function GhostForm({ settings }: { settings: GhostSettings }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const seenIds = new Set(settings.seen_tiers.map((s) => s.id))
  const [siteUrl, setSiteUrl] = useState(settings.site_url ?? "")
  const [checked, setChecked] = useState(() => new Set(settings.allowed_tier_ids.filter((id) => seenIds.has(id))))
  const [otherTiers, setOtherTiers] = useState(settings.allowed_tier_ids.filter((id) => !seenIds.has(id)).join(", "))
  const [defaultMode, setDefaultMode] = useState<AccessMode>(settings.default_access_mode)
  const [confirmSite, setConfirmSite] = useState(false)
  // Saving a different site ends every member's access from the old one (the server drops their passes).
  const siteChanges = !!settings.site_url && siteUrl.trim() !== settings.site_url

  const save = useMutation({
    mutationFn: async () => {
      const allowed = [...new Set([...checked, ...otherTiers.split(/[\s,]+/).filter(Boolean)])]
      const res = await fetchAdmin("settings/ghost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_url: siteUrl.trim() || null, allowed_tier_ids: allowed, default_access_mode: defaultMode }),
      })
      return handleApiResponse<GhostSettings>(res, GhostSettingsSchema)
    },
    onSuccess: (next) => {
      queryClient.setQueryData(KEY, next)
      toast.success(t("Saved."))
    },
    // The server checks the site on save, so a typo fails here with its reason, not at the first reader.
    onError: (err: Error) => toast.error(err.message || t("Couldn't save the Ghost settings.")),
  })

  const rotate = useMutation({
    mutationFn: async () =>
      handleApiResponse<{ webhook_secret: string }>(await fetchAdmin("settings/ghost/webhook-secret", { method: "POST" })),
    onSuccess: ({ webhook_secret }) => {
      queryClient.setQueryData<GhostSettings>(KEY, (old) => old && { ...old, webhook_secret })
      toast.success(t("New secret made. Paste it into your Ghost integration."))
    },
    onError: (err: Error) => toast.error(err.message || t("Couldn't make a new secret.")),
  })

  const toggleTier = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const lastWebhook = relativeTime(settings.last_webhook_at)

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t(GHOST.title)}</h1>
          {settings.site_url ? (
            <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-800">
              <CircleCheck aria-hidden />
              {t("Connected")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <CircleDashed aria-hidden />
              {t("Not connected")}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(GHOST.description)}{" "}
          <a href={SUBSCRIPTIONS_DOC} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
            {t("Learn more about members-only books")}
          </a>
        </p>
      </div>

      <form
        className="space-y-6 rounded-xl border bg-card p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault()
          if (siteChanges) setConfirmSite(true)
          else save.mutate()
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="site-url">{t("Ghost site URL")}</Label>
          <Input id="site-url" type="url" placeholder="https://example.com"
            aria-describedby="site-url-help" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
          <p id="site-url-help" className="text-xs text-muted-foreground">{t("Must start with https://. Leave empty to disconnect Ghost.")}</p>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t("Allowed tiers")}</legend>
          <p className="text-xs text-muted-foreground">{t("Leave all unticked to let any paid member read.")}</p>
          {settings.seen_tiers.map((tier) => (
            <label key={tier.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked.has(tier.id)} onCheckedChange={(c) => toggleTier(tier.id, !!c)} />
              <span className="font-mono text-xs">{tier.id}</span>
              <span className="text-xs text-muted-foreground">
                {t(tier.members === 1 ? "1 member" : "{{count}} members", { count: tier.members })}
              </span>
            </label>
          ))}
          <Label htmlFor="other-tiers" className="mt-2 text-xs font-normal text-muted-foreground">
            {t("Other tier IDs, separated by commas")}
          </Label>
          <Input id="other-tiers" value={otherTiers} onChange={(e) => setOtherTiers(e.target.value)} className="font-mono text-xs" />
        </fieldset>

        <div className="grid gap-2 border-t pt-6">
          <Label htmlFor="default-mode">{t("Access for new books")}</Label>
          <NativeSelect id="default-mode" className="w-full" value={defaultMode} onChange={(e) => setDefaultMode(e.target.value as AccessMode)}>
            {(Object.keys(ACCESS_MODES) as AccessMode[]).map((m) => (
              <option key={m} value={m}>{t(ACCESS_MODES[m].label)}</option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">{t(ACCESS_MODES[defaultMode].help)}</p>
        </div>

        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("Save")}
        </Button>
        <AlertDialog open={confirmSite} onOpenChange={setConfirmSite}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(siteUrl.trim() ? "Change the Ghost site?" : "Disconnect Ghost?")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("Members of {{site}} lose access to subscription books right away.", { site: settings.site_url })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => save.mutate()}>
                {t(siteUrl.trim() ? "Change site" : "Disconnect")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>

      {!settings.site_url ? (
        <Alert role="status">
          <Unplug aria-hidden />
          <AlertTitle>{t("Ghost isn't connected yet")}</AlertTitle>
          <AlertDescription>{t("Save your Ghost site URL to get the code to paste into Ghost.")}</AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-semibold">{t("1. Add the code to Ghost")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("In Ghost, open Settings → Code injection → Site footer, and paste this code.")}
            </p>
            <Textarea aria-label={t("Code injection snippet")} readOnly value={settings.snippet ?? ""} rows={6} className="font-mono text-xs" />
            <CopyButton value={settings.snippet ?? ""} label={t("Copy code")} />
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-semibold">{t("2. End access when a member cancels")}</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t("In Ghost, open Settings → Integrations → Add custom integration, and name it Lenny.")}</li>
              <li>{t("Add a webhook for the event Member updated, with the URL and secret below.")}</li>
              <li>{t("Add a second webhook for the event Member deleted, with the same URL and secret.")}</li>
            </ol>
            <a href={WEBHOOKS_DOC} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">
              {t("Learn more about ending access with webhooks")}
            </a>

            <div className="grid gap-2">
              <Label htmlFor="webhook-url">{t("Webhook URL")}</Label>
              <div className="flex gap-2">
                <Input id="webhook-url" readOnly value={settings.webhook_url} className="font-mono text-xs" />
                <CopyButton value={settings.webhook_url} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="webhook-secret">{t("Webhook secret")}</Label>
              <div className="flex gap-2">
                <Input id="webhook-secret" type="password" readOnly value={settings.webhook_secret ?? ""} className="font-mono text-xs" />
                <CopyButton value={settings.webhook_secret ?? ""} />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-fit" disabled={rotate.isPending}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    {t("Make a new secret")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("Make a new webhook secret?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("The old secret stops working right away. Until you paste the new one into both Ghost webhooks, cancelled members keep access until their {{hours}}-hour pass runs out.", { hours: settings.lease_hours })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => rotate.mutate()}>{t("Make a new secret")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {lastWebhook ? (
              <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-800">
                <CircleCheck aria-hidden />
                {t("Last webhook received {{when}}", { when: lastWebhook })}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <CircleDashed aria-hidden />
                {t("No webhook received yet")}
              </Badge>
            )}
            <Alert>
              <Info aria-hidden />
              <AlertTitle>{t("On Ghost(Pro) Starter?")}</AlertTitle>
              <AlertDescription>
                {t("Ghost(Pro) Starter doesn't send custom webhooks. On that plan, a member who cancels keeps access until their {{hours}}-hour pass runs out.", { hours: settings.lease_hours })}
              </AlertDescription>
            </Alert>
          </section>
        </>
      )}
    </div>
  )
}
