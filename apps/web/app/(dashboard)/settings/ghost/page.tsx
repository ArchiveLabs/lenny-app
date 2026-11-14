"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { BarChart3, ChevronDown, CircleAlert, CircleCheck, CircleDashed, CirclePause, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Switch } from "@workspace/ui/components/switch"
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
import { CodeField, FIELD_HELP } from "@/components/code-field"
import { CopyButton } from "@/components/copy-button"
import { ErrorState } from "@/components/ErrorState"
import { TierName } from "@/components/TierName"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { relativeTime } from "@/lib/preload/time"
import { GHOST, STATS, SUBSCRIPTIONS_DOC, WEBHOOKS_DOC } from "@/lib/subscriptions"
import { ApiError, GhostSettings, GhostSettingsSchema } from "@/types/api"
import { GHOST_SETTINGS_KEY as KEY, useGhostSettings } from "@/hooks/use-ghost-settings"

const CARD = "rounded-xl border bg-card shadow-sm"

export default function GhostSettingsPage() {
  const { t } = useTranslation()
  const { data, isLoading, error } = useGhostSettings()

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
  return <GhostPage settings={data} />
}

/** PUT only the fields given; the server leaves the rest as they are. */
function useSaveGhost() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ body }: { body: Partial<Pick<GhostSettings, "site_url" | "allowed_tier_ids" | "enabled">>; done: string }) =>
      handleApiResponse<GhostSettings>(
        await fetchAdmin("settings/ghost", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
        GhostSettingsSchema,
      ),
    onSuccess: (next, { done }) => {
      queryClient.setQueryData(KEY, next)
      toast.success(done)
    },
    // The server checks the site on save, so a typo fails here with its reason, not at the first reader.
    onError: (err: Error) => toast.error(err.message || t("Couldn't save the Ghost settings.")),
  })
}

function GhostPage({ settings }: { settings: GhostSettings }) {
  const { t } = useTranslation()
  const connected = !!settings.site_url

  return (
    <div className="max-w-2xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t(GHOST.title)}</h1>
            <StatusBadge settings={settings} />
          </div>
          <p className="text-sm text-muted-foreground">
            {t(GHOST.description)}{" "}
            <a href={SUBSCRIPTIONS_DOC} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
              {t("Learn more about members-only books")}
            </a>
          </p>
        </div>
        {connected && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={STATS.route}>
              <BarChart3 aria-hidden />
              {t("See subscription stats")}
            </Link>
          </Button>
        )}
      </header>

      {connected ? (
        <>
          <Overview settings={settings} />
          <WhoCanRead settings={settings} />
          <Setup settings={settings} />
        </>
      ) : (
        <Connect />
      )}
    </div>
  )
}

function StatusBadge({ settings }: { settings: GhostSettings }) {
  const { t } = useTranslation()
  if (!settings.site_url)
    return (
      <Badge variant="secondary" className="gap-1">
        <CircleDashed aria-hidden />
        {t("Not connected")}
      </Badge>
    )
  if (!settings.enabled)
    return (
      <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-800">
        <CirclePause aria-hidden />
        {t("Turned off")}
      </Badge>
    )
  return (
    <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-800">
      <CircleCheck aria-hidden />
      {t("Connected")}
    </Badge>
  )
}

/** First visit: the site is the only thing to fill in; everything else appears once it is saved. */
function Connect() {
  const { t } = useTranslation()
  const save = useSaveGhost()
  const [siteUrl, setSiteUrl] = useState("")
  return (
    <form
      className={`${CARD} space-y-4 p-6`}
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate({ body: { site_url: siteUrl.trim() || null }, done: t("Ghost connected.") })
      }}
    >
      <div className="space-y-1">
        <h2 className="font-semibold">{t("Connect your Ghost site")}</h2>
        <p className="text-sm text-muted-foreground">{t("Once it's saved, you get the code to paste into Ghost.")}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="site-url">{t("Ghost site URL")}</Label>
        <div className="flex gap-2">
          <Input id="site-url" type="url" required placeholder="https://example.com" aria-describedby="site-url-help"
            value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
          <Button type="submit" disabled={save.isPending || !siteUrl.trim()}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {t("Connect")}
          </Button>
        </div>
        <p id="site-url-help" className={FIELD_HELP}>{t("Your public site address, starting with https://.")}</p>
      </div>
    </form>
  )
}

function Row({ title, help, children }: { title: ReactNode; help?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        {help && <div className="text-[13px] text-muted-foreground">{help}</div>}
      </div>
      {children}
    </div>
  )
}

/** What is live right now: reading on or off, which site, whether cancellations reach Lenny. */
function Overview({ settings }: { settings: GhostSettings }) {
  const { t } = useTranslation()
  const site = settings.site_url!
  const host = site.replace(/^https?:\/\//, "").replace(/\/$/, "") // keeps the path of a Ghost under one
  const toggle = useSaveGhost()
  const save = useSaveGhost()
  const [editing, setEditing] = useState(false)
  const [siteUrl, setSiteUrl] = useState(site)
  const [confirm, setConfirm] = useState(false)
  const lastWebhook = relativeTime(settings.last_webhook_at)

  // Saving a different site, or none, ends every member's access from this one (the server drops their passes).
  const saveSite = () =>
    save.mutate(
      { body: { site_url: siteUrl.trim() || null }, done: t(siteUrl.trim() ? "Ghost site changed." : "Ghost disconnected.") },
      { onSuccess: () => setEditing(false) },
    )

  return (
    <section className={`${CARD} divide-y`} aria-label={t("Overview")}>
      <Row
        title={<Label htmlFor="ghost-enabled">{t("Let Ghost members read subscription books")}</Label>}
        help={
          <span id="ghost-enabled-help">
            {settings.enabled
              ? t("Turn off to pause Ghost. Your site, tiers and members' passes stay saved.")
              : t("Off. Members of {{site}} can't read subscription books until you turn it back on.", { site })}
          </span>
        }
      >
        <Switch
          id="ghost-enabled"
          aria-describedby="ghost-enabled-help"
          checked={settings.enabled}
          disabled={toggle.isPending}
          onCheckedChange={(on) => toggle.mutate({ body: { enabled: on }, done: on ? t("Ghost turned on.") : t("Ghost turned off.") })}
        />
      </Row>

      {editing ? (
        <form
          className="space-y-2 px-6 py-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (siteUrl.trim() === site) setEditing(false)
            else setConfirm(true)
          }}
        >
          <Label htmlFor="site-url">{t("Ghost site URL")}</Label>
          <div className="flex flex-wrap gap-2">
            <Input id="site-url" type="url" className="min-w-0 flex-1" aria-describedby="site-url-help" autoFocus
              value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {t("Save site")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setSiteUrl(site); setEditing(false) }}>
              {t("Cancel")}
            </Button>
          </div>
          <p id="site-url-help" className={FIELD_HELP}>{t("Must start with https://. Leave empty to disconnect Ghost.")}</p>
          <AlertDialog open={confirm} onOpenChange={setConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t(siteUrl.trim() ? "Change the Ghost site?" : "Disconnect Ghost?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("Members of {{site}} lose access to subscription books right away.", { site })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={saveSite}>
                  {t(siteUrl.trim() ? "Change site" : "Disconnect")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      ) : (
        <Row
          title={t("Ghost site")}
          help={
            <a href={site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
              {host}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          }
        >
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>{t("Change")}</Button>
        </Row>
      )}

      <Row
        title={t("Cancellations")}
        help={lastWebhook
          ? t("Ghost tells Lenny when a member cancels. Last webhook received {{when}}.", { when: lastWebhook })
          : t("No webhook received yet. Until step 2 below is done, a member who cancels keeps access until their {{hours}}-hour pass runs out.", { hours: settings.lease_hours })}
      >
        {lastWebhook ? (
          <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-800">
            <CircleCheck aria-hidden />
            {t("Working")}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-800">
            <CircleAlert aria-hidden />
            {t("Not set up")}
          </Badge>
        )}
      </Row>
    </section>
  )
}

/** Any paid member, or only some tiers. Every tier on the site is listed, plus any a member holds that the site no longer lists. */
function WhoCanRead({ settings }: { settings: GhostSettings }) {
  const { t } = useTranslation()
  const save = useSaveGhost()
  const names = settings.tier_names ?? {}
  const tiers = [
    ...settings.seen_tiers,
    ...Object.keys(names).filter((id) => !settings.seen_tiers.some((s) => s.id === id)).map((id) => ({ id, members: 0 })),
  ]
  const listed = new Set(tiers.map((s) => s.id))
  const [mode, setMode] = useState(settings.allowed_tier_ids.length ? "tiers" : "any")
  const [checked, setChecked] = useState(() => new Set(settings.allowed_tier_ids.filter((id) => listed.has(id))))
  const [other, setOther] = useState(settings.allowed_tier_ids.filter((id) => !listed.has(id)).join(", "))

  const allowed = mode === "any" ? [] : [...new Set([...checked, ...other.split(/[\s,]+/).filter(Boolean)])]
  const dirty = [...allowed].sort().join() !== [...settings.allowed_tier_ids].sort().join()
  const noneChosen = mode === "tiers" && allowed.length === 0

  const toggleTier = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <form
      className={CARD}
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate({ body: { allowed_tier_ids: allowed }, done: t("Saved.") })
      }}
    >
      <div className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="font-semibold">{t("Who can read")}</h2>
          <p className="text-sm text-muted-foreground">{t("Free members never can. Choose which paid members can.")}</p>
        </div>
        <RadioGroup value={mode} onValueChange={setMode} aria-label={t("Who can read")}>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="any" />
            {t("Any paid member")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="tiers" />
            {t("Only members of these tiers")}
          </label>
        </RadioGroup>

        {mode === "tiers" && (
          <fieldset className="min-w-0 space-y-3 pl-6">
            <legend className="sr-only">{t("Allowed tiers")}</legend>
            {tiers.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {tiers.map((tier) => (
                  <li key={tier.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                      <Checkbox checked={checked.has(tier.id)} onCheckedChange={(c) => toggleTier(tier.id, !!c)} />
                      <span className="min-w-0 flex-1 truncate"><TierName id={tier.id} name={names[tier.id]} /></span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {t(tier.members === 1 ? "1 member" : "{{count}} members", { count: tier.members })}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <details className="group" open={!tiers.length || !!other}>
              <summary className="cursor-pointer list-none text-[13px] text-muted-foreground hover:text-foreground">
                <ChevronDown className="mr-1 inline h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
                {t("Add a tier by ID")}
              </summary>
              <div className="mt-2 grid gap-1.5">
                <Label htmlFor="other-tiers" className="text-xs font-normal text-muted-foreground">
                  {t("Other tier IDs, separated by commas")}
                </Label>
                <Input id="other-tiers" value={other} onChange={(e) => setOther(e.target.value)} className="font-mono text-xs" />
              </div>
            </details>
          </fieldset>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 border-t px-6 py-3">
        {noneChosen && <p className="text-[13px] text-muted-foreground">{t("Pick at least one tier.")}</p>}
        <Button type="submit" size="sm" disabled={!dirty || noneChosen || save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {t("Save")}
        </Button>
      </div>
    </form>
  )
}

/** A setup step that folds away; open while it still needs doing. */
function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <details className="group" open={!done}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-green-100 text-green-800" : "bg-muted text-foreground"}`}
          aria-hidden
        >
          {done ? <CircleCheck className="size-3.5" /> : n}
        </span>
        <span className="flex-1 text-sm font-medium">
          {title}
          {done && <span className="sr-only"> ({t("done")})</span>}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-4 px-6 pb-6 pl-15">{children}</div>
    </details>
  )
}

function Setup({ settings }: { settings: GhostSettings }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // A webhook only arrives once Ghost is wired up, so it marks the whole setup as done.
  const done = !!settings.last_webhook_at

  const rotate = useMutation({
    mutationFn: async () =>
      handleApiResponse<{ webhook_secret: string }>(await fetchAdmin("settings/ghost/webhook-secret", { method: "POST" })),
    onSuccess: ({ webhook_secret }) => {
      queryClient.setQueryData<GhostSettings>(KEY, (old) => old && { ...old, webhook_secret })
      toast.success(t("New secret made. Paste it into your Ghost integration."))
    },
    onError: (err: Error) => toast.error(err.message || t("Couldn't make a new secret.")),
  })

  return (
    <section className={CARD} aria-labelledby="setup-title">
      <div className="space-y-1 px-6 pt-6 pb-2">
        <h2 id="setup-title" className="font-semibold">{t("Set up Ghost")}</h2>
        <p className="text-sm text-muted-foreground">{t("Do these once, in your Ghost admin.")}</p>
      </div>
      <div className="divide-y">
        <Step n={1} title={t("Add the code to Ghost")} done={done}>
          <p className="text-sm text-muted-foreground">{t("In Ghost, open Settings → Code injection → Site footer, and paste this code. Paste it again after you update Lenny.")}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{t("Code injection snippet")}</span>
              <CopyButton value={settings.snippet ?? ""} label={t("Copy code")} />
            </div>
            <textarea
              aria-label={t("Code injection snippet")}
              readOnly
              value={settings.snippet ?? ""}
              onFocus={(e) => e.currentTarget.select()}
              className="block h-40 w-full resize-y rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </Step>

        <Step n={2} title={t("End access when a member cancels")} done={done}>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("In Ghost, open Settings → Integrations → Add custom integration, and name it Lenny.")}</li>
            <li>{t("Add a webhook for the event Member updated, with the URL and secret below.")}</li>
            <li>{t("Add a second webhook for the event Member deleted, with the same URL and secret.")}</li>
          </ol>
          <CodeField id="webhook-url" label={t("Webhook URL")} value={settings.webhook_url} copyLabel={t("Copy webhook URL")} />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="webhook-secret">{t("Webhook secret")}</Label>
              <CopyButton value={settings.webhook_secret ?? ""} ariaLabel={t("Copy webhook secret")} />
            </div>
            <div className="flex gap-2">
              <Input id="webhook-secret" type="password" readOnly value={settings.webhook_secret ?? ""} className="font-mono text-xs" />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" disabled={rotate.isPending}>
                    <RefreshCw aria-hidden />
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
          </div>
          <p className={FIELD_HELP}>
            {t("Ghost(Pro) Starter doesn't send custom webhooks. On that plan, a member who cancels keeps access until their {{hours}}-hour pass runs out.", { hours: settings.lease_hours })}{" "}
            <a href={WEBHOOKS_DOC} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
              {t("Learn more about ending access with webhooks")}
            </a>
          </p>
        </Step>

        <Step n={3} title={t("Add a Read button to a post")}>
          <p className="text-sm text-muted-foreground">
            {t("Open a subscription book in the Library and copy its Read button into a Ghost post. Use the Button card link if the post also goes out as a newsletter: the HTML card works on your website only.")}
          </p>
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href="/library">{t("Open the Library")}</Link>
          </Button>
        </Step>
      </div>
    </section>
  )
}
