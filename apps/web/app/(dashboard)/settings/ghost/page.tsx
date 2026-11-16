"use client"

import { useState, type ReactNode } from "react"
import { useIsFetching, useMutation, useQueryClient } from "@tanstack/react-query"
import { Activity, ChevronDown, CircleCheck, CircleDashed, CirclePause, ExternalLink, ListChecks, Loader2, Plug, RefreshCw, Users } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { cn } from "@workspace/ui/lib/utils"
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
import { Panel, PanelLink } from "@/components/stats/ui"
import { TierName } from "@/components/TierName"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { relativeTime } from "@/lib/preload/time"
import { GHOST, MEMBER_PASSES, STATS, SUBSCRIPTIONS_DOC, WEBHOOKS_DOC } from "@/lib/subscriptions"
import { isHttpUrl } from "@/lib/safe-url"
import { ApiError, GhostSettings, GhostSettingsSchema } from "@/types/api"
import { GHOST_SETTINGS_KEY as KEY, useGhostSettings } from "@/hooks/use-ghost-settings"

/** How often the page asks again while a setup step waits on Ghost (paused in a hidden tab). */
export const SETUP_RECHECK_MS = 10_000

export default function GhostSettingsPage() {
  const { t } = useTranslation()
  // Each ask re-checks the site for the code (Lenny never caches "not found"), so a paste shows within seconds.
  const { data, isLoading, error } = useGhostSettings({
    refetchInterval: ({ state: { data: d } }) =>
      d?.site_url && (d.snippet_installed === false || d.snippet_stale || d.last_launch_at === null) ? SETUP_RECHECK_MS : false,
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
    <div className="@container/main mx-auto w-full max-w-6xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 pb-2">
        <div className="min-w-0 space-y-1">
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
          <nav className="flex gap-2" aria-label={t("Ghost pages")}>
            <PanelLink href={MEMBER_PASSES}>{t("Member passes")}</PanelLink>
            <PanelLink href={STATS.route}>{t("See subscription stats")}</PanelLink>
          </nav>
        )}
      </header>

      {connected ? (
        // Wide: what to change on the left, what is live in a rail on the right. Narrow: status first.
        <div className="grid grid-cols-1 items-start gap-4 @4xl/main:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4 @4xl/main:sticky @4xl/main:top-4 @4xl/main:order-2">
            <Status settings={settings} />
          </div>
          <div className="space-y-4 @4xl/main:order-1">
            <WhoCanRead settings={settings} />
            <Setup settings={settings} />
          </div>
        </div>
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
    <Panel icon={Plug} title={t("Connect your Ghost site")} description={t("Once it's saved, you get the code to paste into Ghost.")} className="max-w-2xl">
      <form
        className="grid gap-2 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ body: { site_url: siteUrl.trim() || null }, done: t("Ghost connected.") })
        }}
      >
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
      </form>
    </Panel>
  )
}

/** A status dot and word, as the dashboard shows its services. */
const TONE = {
  good: ["text-green-700", "bg-green-500"],
  warn: ["text-amber-700", "bg-amber-500"],
  muted: ["text-muted-foreground", "bg-muted-foreground/50"],
} as const

function Dot({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-sm", TONE[tone][0])}>
      <span className={cn("size-1.5 rounded-full", TONE[tone][1])} aria-hidden />
      {children}
    </span>
  )
}

function StatusRow({ label, help, children }: { label: ReactNode; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        {children}
      </div>
      {help && <div className="text-[13px] leading-relaxed text-muted-foreground">{help}</div>}
    </div>
  )
}

/** What is live right now: reading on or off, which site, whether cancellations reach Lenny. */
function Status({ settings }: { settings: GhostSettings }) {
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
      { body: { site_url: siteUrl.trim() || null }, done: t(siteUrl.trim() ? "Ghost site changed. Paste the new webhook secret into both Ghost webhooks." : "Ghost disconnected.") },
      { onSuccess: () => setEditing(false) },
    )

  return (
    <Panel icon={Activity} title={t("Status")}>
      <div className="m-5 mt-4 divide-y rounded-xl border bg-secondary/40 px-4">
        <StatusRow
          label={<Label htmlFor="ghost-enabled">{t("Members-only reading")}</Label>}
          help={
            <span id="ghost-enabled-help">
              {settings.enabled
                ? t("Pausing keeps your site, tiers and members' passes.")
                : t("Paused. Members of {{site}} can't read subscription books until you turn it back on.", { site: host })}
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
        </StatusRow>

        {editing ? (
          <form
            className="grid gap-2 py-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (siteUrl.trim() === site) setEditing(false)
              else setConfirm(true)
            }}
          >
            <Label htmlFor="site-url">{t("Ghost site URL")}</Label>
            <Input id="site-url" type="url" aria-describedby="site-url-help" autoFocus className="bg-background"
              value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
            <p id="site-url-help" className={FIELD_HELP}>{t("Must start with https://. Leave empty to disconnect Ghost.")}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setSiteUrl(site); setEditing(false) }}>
                {t("Cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending && <Loader2 className="animate-spin" />}
                {t("Save site")}
              </Button>
            </div>
            <AlertDialog open={confirm} onOpenChange={setConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t(siteUrl.trim() ? "Change the Ghost site?" : "Disconnect Ghost?")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("Members of {{site}} lose access to subscription books right away.", { site })}
                    {/* Lenny issues a new secret with a new site: the old site must not sign for it. */}
                    {siteUrl.trim() && ` ${t("The webhook secret changes too, so paste the new one into both Ghost webhooks.")}`}
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
          <StatusRow
            label={t("Ghost site")}
            help={
              // The URL came from the server; only an http(s) one becomes a link.
              isHttpUrl(site) ? (
                <a href={site} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 hover:text-foreground hover:underline">
                  <span className="truncate">{host}</span>
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
              ) : <span className="truncate">{host}</span>
            }
          >
            <Button variant="outline" size="sm" className="h-7 bg-background" onClick={() => setEditing(true)}>{t("Change")}</Button>
          </StatusRow>
        )}

        <StatusRow
          label={t("Cancellations")}
          help={lastWebhook
            ? t("Last webhook received {{when}}.", { when: lastWebhook })
            : t("Until step 2 is done, a member who cancels keeps access until their {{hours}}-hour pass runs out.", { hours: settings.lease_hours })}
        >
          {lastWebhook ? <Dot tone="good">{t("Working")}</Dot> : <Dot tone="warn">{t("Not set up")}</Dot>}
        </StatusRow>

        <StatusRow label={t("Pass length")}>
          <span className="text-sm tabular-nums">{t("{{hours}} hours", { hours: settings.lease_hours })}</span>
        </StatusRow>
      </div>
    </Panel>
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

  const option = (value: string, title: string, help: string) => (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
        mode === value ? "border-primary/40 bg-primary/5" : "hover:bg-secondary/40",
      )}
    >
      <RadioGroupItem value={value} className="mt-0.5" aria-label={title} />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[13px] text-muted-foreground">{help}</span>
      </span>
    </label>
  )

  return (
    <Panel icon={Users} title={t("Who can read")} description={t("Free members never can. Choose which paid members can.")}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ body: { allowed_tier_ids: allowed }, done: t("Saved.") })
        }}
      >
        <div className="space-y-4 p-5">
          <RadioGroup value={mode} onValueChange={setMode} aria-label={t("Who can read")} className="grid gap-3 @2xl/main:grid-cols-2">
            {option("any", t("Any paid member"), t("Every paid tier, now and later."))}
            {option("tiers", t("Only members of these tiers"), t("Pick the tiers below."))}
          </RadioGroup>

          {mode === "tiers" && (
            <fieldset className="min-w-0 space-y-3">
              <legend className="sr-only">{t("Allowed tiers")}</legend>
              {tiers.length > 0 && (
                <ul className="divide-y rounded-xl border">
                  {tiers.map((tier) => (
                    <li key={tier.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-secondary/40">
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
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
                  <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
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
        <div className="flex items-center justify-end gap-3 border-t bg-secondary/30 px-5 py-3">
          {noneChosen && <p className="text-[13px] text-muted-foreground">{t("Pick at least one tier.")}</p>}
          <Button type="submit" size="sm" disabled={!dirty || noneChosen || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {t("Save")}
          </Button>
        </div>
      </form>
    </Panel>
  )
}

/** done: Lenny has proof. todo: it has none yet. unknown: this server can't tell. */
type StepState = "done" | "todo" | "unknown"
const STEP_STATE: Record<StepState, { label: string; tone: keyof typeof TONE }> = {
  done: { label: "Done", tone: "good" },
  todo: { label: "Waiting", tone: "warn" },
  unknown: { label: "Can't check", tone: "muted" },
}

/** A setup step with its state and the proof behind it; folds away once done. */
function Step({ n, title, state, note, children }: { n: number; title: string; state: StepState; note: string; children: ReactNode }) {
  const { t } = useTranslation()
  const done = state === "done"
  return (
    <details className="group" open={!done}>
      <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 hover:bg-secondary/30">
        <span
          className={cn(
            "mt-px flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
            done ? "border-green-200 bg-green-50 text-green-700" : "bg-background",
          )}
          aria-hidden
        >
          {done ? <CircleCheck className="size-3.5" /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-[13px] text-muted-foreground">{note}</span>
        </span>
        <Dot tone={STEP_STATE[state].tone}>{t(STEP_STATE[state].label)}</Dot>
        <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-4 px-5 pb-5 sm:pl-14">{children}</div>
    </details>
  )
}

function Setup({ settings }: { settings: GhostSettings }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const host = settings.site_url!.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const checking = useIsFetching({ queryKey: KEY }) > 0
  const webhook = relativeTime(settings.last_webhook_at)
  const launch = relativeTime(settings.last_launch_at)
  // The site check wins; without it, a member opening a book proves the code works.
  // A leftover old copy can take the click with an old address, so it blocks done.
  const code: StepState = settings.snippet_stale
    ? "todo"
    : settings.snippet_installed != null ? (settings.snippet_installed ? "done" : "todo") : launch ? "done" : "unknown"
  const hooks: StepState = webhook ? "done" : "todo"
  const button: StepState = launch ? "done" : settings.last_launch_at === undefined ? "unknown" : "todo"
  const steps = [code, hooks, button]
  const doneCount = steps.filter((s) => s === "done").length

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
    <Panel
      icon={ListChecks}
      title={t("Set up Ghost")}
      description={t("Three steps in your Ghost admin.")}
      action={
        doneCount === steps.length ? (
          <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-800">
            <CircleCheck aria-hidden />
            {t("All set")}
          </Badge>
        ) : (
          <Badge variant="secondary">{t("{{done}} of {{total}} done", { done: doneCount, total: steps.length })}</Badge>
        )
      }
    >
      <div className="mt-4 divide-y border-t">
        <Step
          n={1}
          title={t("Add the code to Ghost")}
          state={code}
          note={
            settings.snippet_stale ? t("An older copy of the Lenny code is on {{site}}. Remove every older copy from Site header and Site footer now: an old copy sends members' sign-in tokens to an address Lenny no longer uses, and whoever gets that address later could use them. Then paste this one into Site header.", { site: host })
              : settings.snippet_installed === true ? t("Found on {{site}}.", { site: host })
              : settings.snippet_installed === false ? t("Not found on {{site}}. Paste it, or paste it again if you updated Lenny.", { site: host })
                : launch ? t("A member opened a book, so the code works.")
                  : t("Lenny can't check your site. This shows as done once a member opens a book.")
          }
        >
          <p className="text-sm text-muted-foreground">{t("In Ghost, open Settings → Code injection → Site header, and paste this code in place of any older Lenny code. Remove any from Site footer too. Paste it again after you update Lenny, and whenever Lenny's address changes.")}</p>
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
          {code === "todo" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-secondary/40 px-3 py-2">
              {/* Not a live region: background checks run every few seconds and would be read out each time. */}
              <p className="text-[13px] text-muted-foreground">
                {t("Lenny checks your site every {{s}} seconds while this page is open.", { s: SETUP_RECHECK_MS / 1000 })}
              </p>
              <Button type="button" variant="outline" size="sm" className="bg-background" disabled={checking}
                onClick={() => queryClient.invalidateQueries({ queryKey: KEY })}>
                {checking ? <Loader2 className="animate-spin" /> : <RefreshCw aria-hidden />}
                {t("Check now")}
              </Button>
            </div>
          )}
        </Step>

        <Step
          n={2}
          title={t("End access when a member cancels")}
          state={hooks}
          note={webhook
            ? t("Last webhook received {{when}}.", { when: webhook })
            : t("Waiting for the first webhook. Ghost sends one when a member's details change.")}
        >
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
            <div className="flex flex-wrap gap-2">
              <Input id="webhook-secret" type="password" readOnly value={settings.webhook_secret ?? ""} className="min-w-0 flex-1 font-mono text-xs" />
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

        <Step
          n={3}
          title={t("Add a Read button to a post")}
          state={button}
          note={launch
            ? t("A member last opened a book {{when}}.", { when: launch })
            : settings.last_launch_at === undefined
              ? t("Update Lenny to see when members open books.")
              : t("No member has opened a book yet. Try a Read button yourself.")}
        >
          <p className="text-sm text-muted-foreground">
            {t("Open a subscription book in the Library and copy its Read button into a Ghost post, as a Button card link or as HTML card code. Both work on your site and in newsletters.")}
          </p>
          <div className="flex">
            <PanelLink href="/library">{t("Open the Library")}</PanelLink>
          </div>
        </Step>
      </div>
    </Panel>
  )
}
