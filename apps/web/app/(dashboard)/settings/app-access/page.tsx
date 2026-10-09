"use client"

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchAdmin, handleApiResponse, redirectToLogin } from "@/lib/api-client"
import { OAUTH2_CLIENTS_KEY, useOAuth2Clients } from "@/hooks/use-oauth2-clients"
import { ApiError, OAuth2Client, OAuth2ClientCreated, OAuth2ClientCreatedSchema, OAuth2ClientUpdated, OAuth2ClientUpdatedSchema, OAuth2Connection, OAuth2SecretRotatedSchema } from "@/types/api"
import { AlertTriangle, Check, ChevronDown, Copy, KeyRound, Loader2, Pencil, Plus, PlugZap, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
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
import { APP_ACCESS, SIGN_IN_PROVIDER } from "@/lib/app-access"
import { ErrorState } from "@/components/ErrorState"
import { useTranslation } from "react-i18next"

// Plain-words permission labels; unknown scopes fall back to the API's description.
const SCOPE_LABELS: Record<string, string> = {
    "loans:read": "See which books you have on loan",
    borrow: "Borrow and return books",
}

function post<T>(path: string, body?: unknown, schema?: Parameters<typeof handleApiResponse<T>>[1]) {
    return fetchAdmin(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    }).then((res) => handleApiResponse<T>(res, schema))
}

// One place for failed-request wording. An expired admin session goes to the login page instead
// of a toast; anything that isn't an API answer (network down) gets a plain explanation.
function useFailureHandler() {
    const { t } = useTranslation()
    return (e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
            void redirectToLogin()
            return
        }
        toast.error(e instanceof ApiError ? e.message : t(APP_ACCESS.networkError))
    }
}

// Radix only returns focus to a <Trigger>; these dialogs are opened from state, so without this
// keyboard users land on <body> after closing. Remember the opener and give focus back to it
// (or to the page heading if that element is gone, e.g. a removed row).
function useOpener() {
    const ref = useRef<HTMLElement | null>(null)
    return {
        remember: () => {
            ref.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        },
        onCloseAutoFocus: (e: Event) => {
            e.preventDefault()
            const el = ref.current
            if (el && el.isConnected && !(el as HTMLButtonElement).disabled) el.focus()
            else document.getElementById("app-access-heading")?.focus()
        },
    }
}

// Synchronous in-flight latch: a mutation's isPending only flips after the next render,
// so two quick clicks could both pass an isPending check.
function useInFlight() {
    const ref = useRef(false)
    return {
        start: () => {
            if (ref.current) return false
            ref.current = true
            return true
        },
        done: () => {
            ref.current = false
        },
    }
}

function AppsSkeleton() {
    return (
        <div className="space-y-3" aria-busy="true" aria-label="Loading apps">
            <Skeleton className="h-5 w-56" />
            {[0, 1].map((i) => (
                <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-52" />
                </div>
            ))}
        </div>
    )
}

function useIsDesktop() {
    return useSyncExternalStore(
        (cb) => {
            const mq = window.matchMedia("(min-width: 768px)")
            mq.addEventListener("change", cb)
            return () => mq.removeEventListener("change", cb)
        },
        () => window.matchMedia("(min-width: 768px)").matches,
        () => true
    )
}

function CopyButton({ value, label }: { value: string; label: string }) {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            toast.error(t("Copy failed. Select the text and copy it manually."))
        }
    }
    return (
        <Button type="button" variant="outline" size="icon" className="size-(--tap-target) shrink-0" onClick={copy} aria-label={`${t("Copy")} ${label}`}>
            {copied ? <Check /> : <Copy />}
        </Button>
    )
}

export default function AppAccessPage() {
    return (
        <Suspense>
            <AppAccess />
        </Suspense>
    )
}

function AppAccess() {
    const { t } = useTranslation()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const tab = searchParams.get("tab") === "developers" ? "developers" : "apps"
    const [sheetOpen, setSheetOpen] = useState(false)
    const [sheetClient, setSheetClient] = useState<OAuth2Client | null>(null)
    const [sheetKey, setSheetKey] = useState(0)
    // The one-time secret lives only in this state; closing the dialog drops it.
    const [secret, setSecret] = useState<{ name: string; value: string } | null>(null)
    const sheetOpener = useOpener()
    const openSheet = (client: OAuth2Client | null) => {
        sheetOpener.remember()
        setSheetClient(client)
        setSheetKey((k) => k + 1)
        setSheetOpen(true)
    }
    const { data, isLoading, error, refetch } = useOAuth2Clients()
    const sessionExpired = error instanceof ApiError && error.status === 401
    useEffect(() => {
        if (sessionExpired) void redirectToLogin()
    }, [sessionExpired])

    const setTab = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "apps") params.delete("tab")
        else params.set("tab", value)
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
    }

    if (error && !data) {
        if (sessionExpired) return null // redirecting to login
        const unsupported = error instanceof ApiError && error.status === 404
        return (
            <ErrorState
                message={unsupported ? t(APP_ACCESS.unsupported) : error instanceof ApiError ? error.message || t(APP_ACCESS.loadFailed) : t(APP_ACCESS.networkError)}
                onRetry={() => refetch()}
            />
        )
    }
    const loading = isLoading && !data

    return (
        <div className="max-w-3xl w-full min-w-0 space-y-6 animate-in fade-in duration-500">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link href="/settings" className="inline-flex min-h-(--tap-target) items-center">{t("Settings")}</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{t(APP_ACCESS.title)}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div>
                <h1 id="app-access-heading" tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">{t(APP_ACCESS.title)}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t(APP_ACCESS.description)}</p>
                <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm font-medium" aria-label={t("How it works")}>
                    {t(APP_ACCESS.flow)}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                    {t(APP_ACCESS.otherNote)}{" "}
                    <Link href={SIGN_IN_PROVIDER.route} className="underline underline-offset-4 hover:text-foreground">{t(APP_ACCESS.otherLink)}</Link>.
                </p>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="h-[calc(var(--tap-target)+6px)]! w-full sm:w-fit">
                    <TabsTrigger value="apps" className="min-h-(--tap-target) flex-1 sm:flex-none sm:px-6">{t("Apps")}</TabsTrigger>
                    <TabsTrigger value="developers" className="min-h-(--tap-target) flex-1 sm:flex-none sm:px-6">{t("For developers")}</TabsTrigger>
                </TabsList>

                <TabsContent value="apps" className="space-y-4 pt-2">
                    <AppsTab
                        loading={loading}
                        clients={data?.clients ?? []}
                        onAdd={() => openSheet(null)}
                        onEdit={(c) => openSheet(c)}
                        onSecret={setSecret}
                    />
                </TabsContent>
                <TabsContent value="developers" className="space-y-6 pt-2">
                    <DevelopersTab loading={loading} connection={data?.connection} />
                </TabsContent>
            </Tabs>

            <AppSheet
                key={sheetKey}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                client={sheetClient}
                scopes={data?.available_scopes ?? []}
                onSecret={setSecret}
                onCloseAutoFocus={sheetOpener.onCloseAutoFocus}
            />
            <SecretDialog secret={secret} onClose={() => setSecret(null)} />
        </div>
    )
}

function hostOf(uri: string): string {
    try {
        return new URL(uri).host || uri
    } catch {
        return uri
    }
}

function AppSwitch({ on, name, disabled, onChange }: { on: boolean; name: string; disabled?: boolean; onChange: (next: boolean) => void }) {
    const { t } = useTranslation()
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={t(APP_ACCESS.switchLabel(name))}
            disabled={disabled}
            onClick={() => onChange(!on)}
            className="group/switch flex min-h-(--tap-target) min-w-(--tap-target) shrink-0 items-center justify-center gap-2 rounded-full px-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        >
            <span className={`text-sm font-medium ${on ? "text-primary" : "text-muted-foreground"}`}>{on ? t(APP_ACCESS.on) : t(APP_ACCESS.off)}</span>
            <span className={`relative h-6 w-10 rounded-full border transition-colors ${on ? "border-primary bg-primary" : "border-input bg-muted"}`}>
                <span className={`absolute top-0.5 size-4.5 rounded-full bg-background shadow transition-[left] ${on ? "left-[calc(100%-1.25rem)]" : "left-0.5"}`} />
            </span>
        </button>
    )
}

function Disclosure({ open, onToggle, controls, children }: { open: boolean; onToggle: () => void; controls: string; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-expanded={open}
            aria-controls={controls}
            onClick={onToggle}
            className="flex min-h-(--tap-target) w-full items-center justify-between gap-2 rounded-md px-1 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
            {children}
            <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
    )
}

function AppRow({
    c, open, onToggleOpen, busy, onSwitch, onEdit, onReset, onRemove,
}: {
    c: OAuth2Client; open: boolean; onToggleOpen: () => void; busy: boolean; onSwitch: (next: boolean) => void
    onEdit: () => void; onReset: () => void; onRemove: () => void
}) {
    const { t } = useTranslation()
    const on = c.status === "active"
    const detailsId = `details-${c.client_id.replace(/[^a-zA-Z0-9_-]/g, "_")}`
    const added = c.created_at && !Number.isNaN(Date.parse(c.created_at)) ? new Date(c.created_at).toLocaleDateString() : null
    return (
        <li className="rounded-xl border bg-card shadow-sm min-w-0">
            <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="font-medium break-words min-w-0">{c.name}</h3>
                        {c.is_default && (
                            <Badge variant="outline" title={t(APP_ACCESS.builtInHelp)}>{t(APP_ACCESS.builtIn)}</Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground break-all">{hostOf(c.redirect_uris[0] ?? "")}</p>
                    <p className="text-xs text-muted-foreground">{on ? t(APP_ACCESS.onLine) : t(APP_ACCESS.offLine)}</p>
                </div>
                <AppSwitch on={on} name={c.name} disabled={busy} onChange={onSwitch} />
            </div>

            <div className="border-t px-3">
                <Disclosure open={open} onToggle={onToggleOpen} controls={detailsId}>
                    {open ? t(APP_ACCESS.hideDetails) : t(APP_ACCESS.details)}
                </Disclosure>
            </div>

            {open && (
                <div id={detailsId} className="space-y-4 border-t px-4 py-4">
                    {c.is_default && <p className="text-xs text-muted-foreground">{t(APP_ACCESS.builtInHelp)}</p>}

                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">{t("Client ID")}</p>
                        <div className="flex items-center gap-2 min-w-0">
                            <code className="min-w-0 flex-1 rounded-md bg-muted px-2.5 py-2 text-xs break-all">{c.client_id}</code>
                            <CopyButton value={c.client_id} label={t("client ID")} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">{t(APP_ACCESS.urlsLabel)}</p>
                        <ul className="space-y-1">
                            {c.redirect_uris.map((u) => (
                                <li key={u}><code className="text-xs break-all">{u}</code></li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">{t("Permissions")}</p>
                        <ul className="space-y-1">
                            {c.scopes.map((s) => (
                                <li key={s} className="text-sm">
                                    {SCOPE_LABELS[s] ? t(SCOPE_LABELS[s] as string) : s}
                                    {SCOPE_LABELS[s] && <code className="ml-2 text-xs text-muted-foreground">{s}</code>}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <p className="text-sm text-muted-foreground">{c.is_confidential ? t(APP_ACCESS.typeServer) : t(APP_ACCESS.typePublic)}</p>
                    {added && <p className="text-xs text-muted-foreground">{t(APP_ACCESS.addedOn)} {added}</p>}

                    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                        <Button type="button" variant="outline" className="min-h-(--tap-target)" disabled={busy} onClick={onEdit}>
                            <Pencil /> {t(APP_ACCESS.edit)}
                        </Button>
                        {c.is_confidential && (
                            <Button type="button" variant="outline" className="min-h-(--tap-target)" disabled={busy} onClick={onReset}>
                                <KeyRound /> {t(APP_ACCESS.resetSecret)}
                            </Button>
                        )}
                        {!on && !c.is_default && (
                            <Button type="button" variant="ghost" className="min-h-(--tap-target) text-muted-foreground hover:text-foreground" disabled={busy} onClick={onRemove}>
                                <Trash2 /> {t(APP_ACCESS.removeApp)}
                            </Button>
                        )}
                    </div>
                    {c.is_default ? (
                        <p className="text-xs text-muted-foreground">{t(APP_ACCESS.builtInNoRemove)}</p>
                    ) : on ? (
                        <p className="text-xs text-muted-foreground" title={t("Turn it off first.")}>{t(APP_ACCESS.removeHint)}</p>
                    ) : null}
                </div>
            )}
        </li>
    )
}

function AppsTab({
    clients, loading, onAdd, onEdit, onSecret,
}: {
    clients: OAuth2Client[]; loading: boolean; onAdd: () => void; onEdit: (c: OAuth2Client) => void
    onSecret: (s: { name: string; value: string }) => void
}) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const onFailure = useFailureHandler()
    const flight = useInFlight()
    const opener = useOpener()
    const [toTurnOff, setToTurnOff] = useState<OAuth2Client | null>(null)
    const [toReset, setToReset] = useState<OAuth2Client | null>(null)
    const [toRemove, setToRemove] = useState<OAuth2Client | null>(null)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [offOpenOverride, setOffOpenOverride] = useState<boolean | null>(null)

    const toggle = useMutation({
        mutationFn: ({ client, action }: { client: OAuth2Client; action: "enable" | "disable" }) =>
            post(`oauth2/clients/${encodeURIComponent(client.client_id)}/${action}`),
        onSuccess: (_, { client, action }) => {
            toast.success(action === "enable" ? t(APP_ACCESS.turnedOn(client.name)) : t(APP_ACCESS.turnedOff(client.name)))
            queryClient.invalidateQueries({ queryKey: OAUTH2_CLIENTS_KEY })
        },
        onError: onFailure,
        onSettled: flight.done,
    })

    const reset = useMutation({
        // Secret goes straight to the dialog state and is stripped from the cached result.
        mutationFn: async (client: OAuth2Client) => {
            const r = await post<{ client_id: string; client_secret: string }>(
                `oauth2/clients/${encodeURIComponent(client.client_id)}/rotate-secret`, undefined, OAuth2SecretRotatedSchema)
            onSecret({ name: client.name, value: r.client_secret })
            return { client_id: r.client_id }
        },
        onError: onFailure,
        onSettled: flight.done,
    })

    const remove = useMutation({
        mutationFn: async (client: OAuth2Client) =>
            handleApiResponse(await fetchAdmin(`oauth2/clients/${encodeURIComponent(client.client_id)}`, { method: "DELETE" })),
        onSuccess: (_, client) => {
            toast.success(t(APP_ACCESS.removed(client.name)))
            queryClient.invalidateQueries({ queryKey: OAUTH2_CLIENTS_KEY })
        },
        onError: onFailure,
        onSettled: flight.done,
    })

    const anyPending = toggle.isPending || reset.isPending || remove.isPending
    const onApps = clients.filter((c) => c.status === "active")
    const offApps = clients.filter((c) => c.status !== "active")
    const offOpen = offOpenOverride ?? onApps.length === 0
    const toggleExpanded = (id: string) =>
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })

    const renderRow = (c: OAuth2Client) => (
        <AppRow
            key={c.client_id}
            c={c}
            open={expanded.has(c.client_id)}
            onToggleOpen={() => toggleExpanded(c.client_id)}
            busy={anyPending}
            onSwitch={(next) => (next ? flight.start() && toggle.mutate({ client: c, action: "enable" }) : (opener.remember(), setToTurnOff(c)))}
            onEdit={() => onEdit(c)}
            onReset={() => { opener.remember(); setToReset(c) }}
            onRemove={() => { opener.remember(); setToRemove(c) }}
        />
    )

    if (loading) return <AppsSkeleton />

    return (
        <>
            {clients.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center space-y-4">
                    <PlugZap className="mx-auto size-8 text-muted-foreground" aria-hidden />
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t(APP_ACCESS.empty)}</p>
                    <Button className="min-h-(--tap-target)" onClick={onAdd}>
                        <Plus /> {t(APP_ACCESS.add)}
                    </Button>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">{t(APP_ACCESS.summary(onApps.length, offApps.length))}</p>
                        <Button className="min-h-(--tap-target) w-full sm:w-auto" onClick={onAdd}>
                            <Plus /> {t(APP_ACCESS.add)}
                        </Button>
                    </div>

                    {onApps.length > 0 && <ul className="space-y-3">{onApps.map(renderRow)}</ul>}

                    {offApps.length > 0 && (
                        <div className="space-y-2">
                            <Disclosure open={offOpen} onToggle={() => setOffOpenOverride(!offOpen)} controls="turned-off-apps">
                                {t(APP_ACCESS.turnedOffGroup(offApps.length))}
                            </Disclosure>
                            {offOpen && <ul id="turned-off-apps" className="space-y-3">{offApps.map(renderRow)}</ul>}
                        </div>
                    )}
                </>
            )}

            <AlertDialog open={!!toReset} onOpenChange={(o) => !o && setToReset(null)}>
                <AlertDialogContent onCloseAutoFocus={opener.onCloseAutoFocus}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{toReset && t(APP_ACCESS.resetTitle(toReset.name))}</AlertDialogTitle>
                        <AlertDialogDescription>{t(APP_ACCESS.resetBody)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="min-h-(--tap-target)">{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction className="min-h-(--tap-target)" disabled={reset.isPending}
                            onClick={() => toReset && flight.start() && reset.mutate(toReset)}>
                            {t(APP_ACCESS.resetSecret)}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
                <AlertDialogContent onCloseAutoFocus={opener.onCloseAutoFocus}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{toRemove && t(APP_ACCESS.removeTitle(toRemove.name))}</AlertDialogTitle>
                        <AlertDialogDescription>{t(APP_ACCESS.removeBody)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="min-h-(--tap-target)">{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            className="min-h-(--tap-target) bg-destructive text-white hover:bg-destructive/90"
                            disabled={remove.isPending}
                            onClick={() => toRemove && flight.start() && remove.mutate(toRemove)}
                        >
                            {t(APP_ACCESS.removeApp)}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!toTurnOff} onOpenChange={(o) => !o && setToTurnOff(null)}>
                <AlertDialogContent onCloseAutoFocus={opener.onCloseAutoFocus}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{toTurnOff && t(APP_ACCESS.turnOffTitle(toTurnOff.name))}</AlertDialogTitle>
                        <AlertDialogDescription>{t(APP_ACCESS.turnOffBody)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="min-h-(--tap-target)">{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            className="min-h-(--tap-target)"
                            disabled={toggle.isPending}
                            onClick={() => toTurnOff && flight.start() && toggle.mutate({ client: toTurnOff, action: "disable" })}
                        >
                            {t(APP_ACCESS.turnOffAction)}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function DevelopersTab({ connection, loading }: { connection?: OAuth2Connection; loading: boolean }) {
    const { t } = useTranslation()
    if (loading) return <AppsSkeleton />
    const rows: [string, string][] = connection
        ? [
              [t("Issuer"), connection.issuer],
              [t("Discovery URL"), connection.discovery_url],
              [t("Authorization endpoint"), connection.authorization_endpoint],
              [t("Token endpoint"), connection.token_endpoint],
              [t("Revocation endpoint"), connection.revocation_endpoint],
              [t("Grant types"), connection.grant_types.join(", ")],
              [t("PKCE method"), connection.pkce_method],
          ]
        : []

    return (
        <>
            <section className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
                <h2 className="font-medium">{t(APP_ACCESS.developersTitle)}</h2>
                {rows.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("This server did not report its endpoints.")}</p>
                )}
                {rows.map(([label, value]) => (
                    <div key={label} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{label}</Label>
                        <div className="flex items-center gap-2 min-w-0">
                            <code className="min-w-0 flex-1 rounded-md bg-muted px-2.5 py-2 text-xs break-all">{value}</code>
                            <CopyButton value={value} label={label} />
                        </div>
                    </div>
                ))}
            </section>

            <section className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <h2 className="font-medium">{t("How to connect an app")}</h2>
                <ol className="list-decimal space-y-3 pl-5 text-sm">
                    <li>
                        {t("The developer sends the library admin:")}
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                            <li>{t("the app name")}</li>
                            <li>{t("the exact redirect URL(s)")}</li>
                            <li>{t("whether the app can keep a secret (server app) or not (browser or mobile app)")}</li>
                            <li>{t("a fixed client ID, if the app ships with one")}</li>
                            <li>{t("the permissions it needs")}</li>
                        </ul>
                    </li>
                    <li>{t("The admin adds the app in the Apps tab.")}</li>
                    <li>
                        {t("The developer connects using the endpoints above with Authorization Code + PKCE (S256), the client ID, and, for Server apps, the client secret.")}
                    </li>
                </ol>
                <p className="text-xs text-muted-foreground">
                    {t("Redirect URLs must match exactly and must be https, opds:// or a loopback address.")}
                </p>
            </section>
        </>
    )
}

function SecretDialog({ secret, onClose }: { secret: { name: string; value: string } | null; onClose: () => void }) {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(secret?.value ?? "")
            setCopied(true)
        } catch {
            toast.error(t("Copy failed. Select the secret and copy it manually."))
        }
    }
    return (
        <AlertDialog open={!!secret}>
            <AlertDialogContent onCloseAutoFocus={(e) => { e.preventDefault(); document.getElementById("app-access-heading")?.focus() }}>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t(APP_ACCESS.secretTitle)}</AlertDialogTitle>
                    <AlertDialogDescription className="flex items-start gap-2 text-destructive">
                        <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                        {t("This secret is shown only once and cannot be retrieved later. Copy it now and store it somewhere safe.")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {secret && <p className="text-sm text-muted-foreground break-words">{secret.name}</p>}
                <code className="block rounded-md border bg-muted p-3 text-sm break-all select-all">{secret?.value}</code>
                <AlertDialogFooter>
                    <Button variant="outline" className="min-h-(--tap-target)" onClick={copy}>
                        {copied ? <Check /> : <Copy />} {copied ? t("Copied") : t("Copy")}
                    </Button>
                    <AlertDialogAction
                        className="min-h-(--tap-target)"
                        onClick={() => {
                            setCopied(false)
                            onClose()
                        }}
                    >
                        {t("I've saved it")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

const splitUris = (text: string) => text.split(/[\s,]+/).filter(Boolean)

function AppSheet({
    open,
    onOpenChange,
    client,
    scopes,
    onSecret,
    onCloseAutoFocus,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCloseAutoFocus: (e: Event) => void
    client: OAuth2Client | null // null = add, otherwise edit
    scopes: { name: string; description: string }[]
    onSecret: (s: { name: string; value: string }) => void
}) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const onFailure = useFailureHandler()
    const flight = useInFlight()
    const confirmOpener = useOpener()
    const isDesktop = useIsDesktop()
    const editing = client !== null
    const [name, setName] = useState(client?.name ?? "")
    const [uris, setUris] = useState(client?.redirect_uris.join("\n") ?? "")
    const [clientId, setClientId] = useState("")
    const [type, setType] = useState<"public" | "server">("public")
    const [advancedOpen, setAdvancedOpen] = useState(false)
    const [unchecked, setUnchecked] = useState<Set<string>>(
        () => new Set(client ? scopes.map((s) => s.name).filter((n) => !client.scopes.includes(n)) : [])
    )
    const [confirmSave, setConfirmSave] = useState(false)

    // Scopes the API reports that the checkbox list doesn't know about are kept as they are.
    const knownScopes = scopes.map((s) => s.name)
    const keptUnknown = client ? client.scopes.filter((n) => !knownScopes.includes(n)) : []
    const checkedScopes = [...keptUnknown, ...knownScopes.filter((n) => !unchecked.has(n))]
    const uriList = splitUris(uris)
    const removedScopes = client ? client.scopes.filter((n) => !checkedScopes.includes(n)) : []

    const changes: Record<string, unknown> = {}
    if (client) {
        if (name.trim() !== client.name) changes.name = name.trim()
        if (JSON.stringify(uriList) !== JSON.stringify(client.redirect_uris)) changes.redirect_uris = uriList
        if ([...checkedScopes].sort().join() !== [...client.scopes].sort().join()) changes.scopes = checkedScopes
    }
    const valid = name.trim() !== "" && uriList.length > 0 && checkedScopes.length > 0
    const canSave = editing ? valid && Object.keys(changes).length > 0 : checkedScopes.length > 0

    const create = useMutation({
        // The secret goes straight to the dialog state and is stripped from the cached result.
        mutationFn: async (body: Record<string, unknown>) => {
            const created = await post<OAuth2ClientCreated>("oauth2/clients", body, OAuth2ClientCreatedSchema)
            if (created.client_secret) onSecret({ name: created.name, value: created.client_secret })
            return { ...created, client_secret: null }
        },
        onSuccess: () => {
            toast.success(t("App registered"))
            queryClient.invalidateQueries({ queryKey: OAUTH2_CLIENTS_KEY })
            onOpenChange(false)
        },
        onError: onFailure,
        onSettled: flight.done,
    })

    const update = useMutation({
        mutationFn: async (body: Record<string, unknown>) => {
            const res = await fetchAdmin(`oauth2/clients/${encodeURIComponent(client!.client_id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            return handleApiResponse<OAuth2ClientUpdated>(res, OAuth2ClientUpdatedSchema)
        },
        onSuccess: (updated) => {
            const n = updated.revoked_tokens ?? 0
            toast.success(n > 0 ? t(APP_ACCESS.savedRevoked(n)) : t(APP_ACCESS.saved))
            queryClient.invalidateQueries({ queryKey: OAUTH2_CLIENTS_KEY })
            onOpenChange(false)
        },
        onError: onFailure,
        onSettled: flight.done,
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (editing) {
            if (!canSave) return
            if (removedScopes.length > 0) {
                confirmOpener.remember()
                setConfirmSave(true)
            }
            else if (flight.start()) update.mutate(changes)
            return
        }
        if (!flight.start()) return
        const body: Record<string, unknown> = {
            name: name.trim(),
            redirect_uris: uriList,
            public: type === "public",
            scopes: checkedScopes,
        }
        if (clientId.trim()) body.client_id = clientId.trim()
        create.mutate(body)
    }

    const toggleScope = (s: string, on: boolean) =>
        setUnchecked((prev) => {
            const next = new Set(prev)
            if (on) next.delete(s)
            else next.add(s)
            return next
        })

    const permissionsFieldset = (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">{t(APP_ACCESS.permissionsLabel)}</legend>
            {scopes.map((s) => (
                <Label key={s.name} htmlFor={`scope_${s.name}`} className="flex min-h-(--tap-target) items-start gap-3 rounded-lg border p-3 font-normal cursor-pointer">
                    <Checkbox
                        id={`scope_${s.name}`}
                        className="mt-0.5"
                        checked={!unchecked.has(s.name)}
                        onCheckedChange={(c) => toggleScope(s.name, c === true)}
                    />
                    <span className="min-w-0">
                        <span className="block text-sm font-medium">{SCOPE_LABELS[s.name] ? t(SCOPE_LABELS[s.name] as string) : s.description}</span>
                        <code className="block text-xs text-muted-foreground break-all">{s.name}</code>
                    </span>
                </Label>
            ))}
            {editing && removedScopes.length > 0 && (
                <p role="status" className="rounded-md bg-muted p-3 text-sm">{t(APP_ACCESS.revokeNote)}</p>
            )}
            {checkedScopes.length === 0 && <p className="text-xs text-destructive">{t(APP_ACCESS.needScope)}</p>}
        </fieldset>
    )

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent
                    side={isDesktop ? "right" : "bottom"}
                    showCloseButton={false}
                    onCloseAutoFocus={onCloseAutoFocus}
                    className={isDesktop ? "w-full sm:max-w-md gap-0" : "max-h-[92dvh] gap-0 rounded-t-xl"}
                >
                    <SheetHeader className="flex-row items-start justify-between gap-2 border-b">
                        <div className="space-y-1 min-w-0">
                            <SheetTitle>{editing ? t(APP_ACCESS.editTitle) : t(APP_ACCESS.add)}</SheetTitle>
                            <SheetDescription>
                                {editing ? t(APP_ACCESS.editDescription) : t("Register an app that may sign patrons in on this library.")}
                            </SheetDescription>
                        </div>
                        <SheetClose asChild>
                            <Button variant="ghost" size="icon" className="size-(--tap-target) shrink-0" aria-label={t("Close")}>
                                <X />
                            </Button>
                        </SheetClose>
                    </SheetHeader>

                    <form id="add-app-form" onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-4">
                        <div className="space-y-2">
                            <Label htmlFor="app_name">{t(APP_ACCESS.nameLabel)}</Label>
                            <Input id="app_name" required className="min-h-(--tap-target)" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="app_uris">{t(APP_ACCESS.urlsLabel)}</Label>
                            <Textarea
                                id="app_uris"
                                required
                                rows={3}
                                placeholder="https://app.example.com/callback"
                                value={uris}
                                onChange={(e) => setUris(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">{t(APP_ACCESS.urlsHelp)}</p>
                        </div>

                        {editing && client && (
                            <>
                                {permissionsFieldset}
                                <div className="space-y-1.5">
                                    <p className="text-sm font-medium">{t("Client ID")}</p>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <code className="min-w-0 flex-1 rounded-md bg-muted px-2.5 py-2 text-xs break-all">{client.client_id}</code>
                                        <CopyButton value={client.client_id} label={t("client ID")} />
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t(APP_ACCESS.idReadOnly)}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {client.is_confidential ? t(APP_ACCESS.typeServer) : t(APP_ACCESS.typePublic)}
                                </p>
                            </>
                        )}

                        {!editing && (
                            <>
                                <div className="border-t pt-1">
                                    <Disclosure open={advancedOpen} onToggle={() => setAdvancedOpen(!advancedOpen)} controls="add-app-advanced">
                                        {t(APP_ACCESS.advanced)}
                                    </Disclosure>
                                </div>

                                {advancedOpen && (
                                    <div id="add-app-advanced" className="space-y-5">
                                        <fieldset className="space-y-2">
                                            <legend className="text-sm font-medium mb-2">{t("App type")}</legend>
                                            <RadioGroup value={type} onValueChange={(v) => setType(v as "public" | "server")} className="gap-2">
                                                {([
                                                    ["public", "Browser or mobile app", "No secret needed. Relies on PKCE."],
                                                    ["server", "Server app", "Has a secret, shown once after registering."],
                                                ] as const).map(([value, label, help]) => (
                                                    <Label key={value} htmlFor={`type_${value}`} className="flex min-h-(--tap-target) items-start gap-3 rounded-lg border p-3 font-normal cursor-pointer">
                                                        <RadioGroupItem id={`type_${value}`} value={value} className="mt-0.5" />
                                                        <span>
                                                            <span className="block text-sm font-medium">{t(label)}</span>
                                                            <span className="block text-xs text-muted-foreground">{t(help)}</span>
                                                        </span>
                                                    </Label>
                                                ))}
                                            </RadioGroup>
                                        </fieldset>

                                        {permissionsFieldset}

                                        <div className="space-y-2">
                                            <Label htmlFor="app_client_id">{t("Client ID (optional)")}</Label>
                                            <Input
                                                id="app_client_id"
                                                className="min-h-(--tap-target)"
                                                placeholder="my-app"
                                                value={clientId}
                                                onChange={(e) => setClientId(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {t("Only if the app ships with a fixed ID. 3-64 characters: letters, digits, dot, underscore or dash. Generated if left empty.")}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </form>

                    <SheetFooter className="border-t sm:flex-row sm:justify-end">
                        <SheetClose asChild>
                            <Button type="button" variant="outline" className="min-h-(--tap-target)">{t("Cancel")}</Button>
                        </SheetClose>
                        <Button
                            type="submit"
                            form="add-app-form"
                            className="min-h-(--tap-target)"
                            disabled={!canSave || create.isPending || update.isPending}
                        >
                            {(create.isPending || update.isPending) && <Loader2 className="animate-spin" />}{" "}
                            {editing ? t(APP_ACCESS.save) : t("Register app")}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
                <AlertDialogContent onCloseAutoFocus={confirmOpener.onCloseAutoFocus}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t(APP_ACCESS.saveConfirmTitle)}</AlertDialogTitle>
                        <AlertDialogDescription>{t(APP_ACCESS.revokeNote)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="min-h-(--tap-target)">{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction className="min-h-(--tap-target)" disabled={update.isPending}
                            onClick={() => flight.start() && update.mutate(changes)}>
                            {t(APP_ACCESS.save)}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
