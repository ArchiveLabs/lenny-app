"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { ExternalAuthConfig, ExternalAuthConfigSchema, ApiError } from "@/types/api"
import { Loader2, Save, Shield, AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ErrorState } from "@/components/ErrorState"
import Link from "next/link"
import { useTranslation } from "react-i18next"

export default function ExternalAuthPage() {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [config, setConfig] = useState<Partial<ExternalAuthConfig>>({})
    const [clientSecret, setClientSecret] = useState("")
    const [saveSuccess, setSaveSuccess] = useState(false)

    const { data, isLoading, error } = useQuery({
        queryKey: ["external-auth"],
        queryFn: async () => {
            const res = await fetchAdmin("auth/config")
            return handleApiResponse<ExternalAuthConfig>(res, ExternalAuthConfigSchema)
        },
    })

    const lastConfigRef = useRef<string | null>(null)

    useEffect(() => {
        if (data) {
            const dataHash = JSON.stringify(data)
            if (dataHash !== lastConfigRef.current) {
                setConfig({
                    ...data,
                    scopes: Array.isArray(data.scopes) ? data.scopes.join(" ") : data.scopes,
                })
                setClientSecret("") // clear secret input on fresh data
                lastConfigRef.current = dataHash
            }
        }
    }, [data])

    const mutation = useMutation({
        mutationFn: async (payload: Record<string, any>) => {
            const res = await fetchAdmin("auth/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            return handleApiResponse<{ updated: boolean }>(res)
        }
    })

    if (isLoading && !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error && !data) {
        return <ErrorState message={t("Failed to load external auth configuration.")} />
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        
        const payload: Record<string, any> = {
            enabled: config.enabled ?? false,
            discovery_url: config.discovery_url,
            client_id: config.client_id,
            redirect_uri: config.redirect_uri,
            scopes: config.scopes || "openid email profile",
            flow: "pkce"
        }
        
        if (clientSecret) {
            payload.client_secret = clientSecret
        }
        
        try {
            await mutation.mutateAsync(payload)
            toast.success(t("Saved successfully!"))
            await queryClient.refetchQueries({ queryKey: ["external-auth"] })
            await queryClient.refetchQueries({ queryKey: ["auth-mode"] })
        } catch (err: any) {
            if (err instanceof ApiError && err.status === 422) {
                toast.error(err.message)
            } else {
                toast.error(err.message || t("Failed to save configuration"))
            }
        }
    }

    return (
        <div className="max-w-2xl space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold tracking-tight">{t("External Auth (OIDC)")}</h1>
                    {data && (
                        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5
                            ${data.is_ready ? 'bg-green-500/10 text-green-700' : 
                              data.is_configured && !data.enabled ? 'bg-yellow-500/10 text-yellow-700' :
                              'bg-red-500/10 text-red-700'}`}>
                            {data.is_ready ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {data.is_ready ? t("Ready") : data.is_configured && !data.enabled ? t("Disabled") : t("Not Configured")}
                        </div>
                    )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{t("Configure an external OIDC provider like Auth0, Okta, or Keycloak for patron authentication.")}</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="enabled" 
                            checked={config.enabled || false}
                            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked === true })}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor="enabled">{t("Enable External Auth Provider")}</Label>
                            <p className="text-sm text-muted-foreground">
                                {t("If enabled and lending mode is set to External, patrons will be redirected to this provider to log in.")}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label htmlFor="discovery_url">{t("OIDC Discovery URL")}</Label>
                            <Input 
                                id="discovery_url" 
                                placeholder={t("https://your-tenant.auth0.com/.well-known/openid-configuration")} 
                                value={config.discovery_url || ""}
                                onChange={(e) => setConfig({ ...config, discovery_url: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="client_id">{t("Client ID")}</Label>
                            <Input 
                                id="client_id" 
                                placeholder={t("Your OAuth Client ID")} 
                                value={config.client_id || ""}
                                onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="client_secret">{t("Client Secret")}</Label>
                            <Input 
                                id="client_secret" 
                                type="password"
                                placeholder={data?.client_secret_set ? t("•••••••••••••••• (Secret is set)") : t("Your OAuth Client Secret")} 
                                value={clientSecret}
                                onChange={(e) => setClientSecret(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                {data?.client_secret_set ? t("Leave blank to keep existing secret.") : t("Required for most OIDC providers.")}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="scopes">{t("Scopes")}</Label>
                            <Input 
                                id="scopes" 
                                placeholder={t("openid profile email")} 
                                value={config.scopes || ""}
                                onChange={(e) => setConfig({ ...config, scopes: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">{t("Space-separated list of scopes to request.")}</p>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="redirect_uri">{t("Redirect URI")}</Label>
                            <Input 
                                id="redirect_uri" 
                                placeholder={t("https://your-lenny-domain.com/auth/callback")} 
                                value={config.redirect_uri || ""}
                                onChange={(e) => setConfig({ ...config, redirect_uri: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">{t("The callback URL registered with your OIDC provider.")}</p>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-4 border-t">
                        {mutation.error && (
                            <div className="flex items-center gap-2 text-sm text-red-500 font-medium">
                                <AlertCircle className="w-4 h-4" />
                                {mutation.error.message}
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                {t("Save Configuration")}
                            </Button>
                            {saveSuccess && <span className="text-sm text-green-600 font-medium animate-in fade-in">{t("Saved successfully!")}</span>}
                        </div>
                    </div>
                </div>
            </form>
            
            <div className="pt-4">
                <Button variant="outline" asChild>
                    <Link href="/settings">{t("Back to Settings")}</Link>
                </Button>
            </div>
        </div>
    )
}
