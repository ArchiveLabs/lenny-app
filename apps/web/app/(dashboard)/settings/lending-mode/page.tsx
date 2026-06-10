"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { AuthModeConfig, LendingMode, AuthModeConfigSchema, ApiError } from "@/types/api"
import { Loader2, Save, Shield, Key, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Label } from "@workspace/ui/components/label"
import { ErrorState } from "@/components/ErrorState"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { IaAuthToggle } from "@/components/IaAuthToggle"

export default function LendingModePage() {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [mode, setMode] = useState<LendingMode | null>(null)
    const [saveSuccess, setSaveSuccess] = useState(false)

    const { data, isLoading, error } = useQuery({
        queryKey: ["auth-mode"],
        queryFn: async () => {
            const res = await fetchAdmin("settings/auth-mode")
            return handleApiResponse<AuthModeConfig>(res, AuthModeConfigSchema)
        },
    })

    const lastDataModeRef = useRef<LendingMode | null>(null)

    useEffect(() => {
        if (data && data.lending_mode !== lastDataModeRef.current) {
            setMode(data.lending_mode)
            lastDataModeRef.current = data.lending_mode
        }
    }, [data])

    const mutation = useMutation({
        mutationFn: async (newMode: LendingMode) => {
            const res = await fetchAdmin("settings/auth-mode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lending_mode: newMode })
            })
            return handleApiResponse(res)
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
        return <ErrorState message={t("Failed to load lending mode configuration.")} />
    }

    const handleSave = async () => {
        if (!mode) return
        try {
            await mutation.mutateAsync(mode)
            toast.success(t("Saved successfully!"))
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
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">{t("Lending Mode Configuration")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("Configure how patrons check out and access books.")}</p>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
                <RadioGroup value={mode || "none"} onValueChange={(val) => setMode(val as LendingMode)} className="space-y-4">
                    <div className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${mode === "none" ? "border-amber-500 bg-amber-500/5" : "hover:bg-muted/50"}`} onClick={() => setMode("none")}>
                        <RadioGroupItem value="none" id="none" className="mt-1" />
                        <div className="grid gap-1.5 flex-1">
                            <Label htmlFor="none" className="font-semibold flex items-center gap-2 cursor-pointer">
                                <ShieldAlert className="w-4 h-4 text-amber-500" /> {t("Disabled (Catalog Only)")}
                            </Label>
                            <p className="text-sm text-muted-foreground">{t("Lenny operates as a read-only OPAC. Users can browse the catalog but cannot check out books or read encrypted files.")}</p>
                        </div>
                    </div>

                    <div className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${mode === "ol" ? "border-blue-500 bg-blue-500/5" : "hover:bg-muted/50"}`} onClick={() => setMode("ol")}>
                        <RadioGroupItem value="ol" id="ol" className="mt-1" />
                        <div className="grid gap-1.5 flex-1">
                            <Label htmlFor="ol" className="font-semibold flex items-center gap-2 cursor-pointer">
                                <Key className="w-4 h-4 text-blue-500" /> {t("OpenLibrary Auth")}
                            </Label>
                            <p className="text-sm text-muted-foreground">{t("Patrons authenticate using OpenLibrary. Requires an OpenLibrary account to be configured.")}</p>
                            {!data?.ol_ready && (
                                <p className="text-xs font-semibold text-red-500 mt-1">{t("Warning: OpenLibrary account is not fully configured.")}</p>
                            )}
                        </div>
                    </div>

                    <div className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${mode === "external" ? "border-green-500 bg-green-500/5" : "hover:bg-muted/50"}`} onClick={() => setMode("external")}>
                        <RadioGroupItem value="external" id="external" className="mt-1" />
                        <div className="grid gap-1.5 flex-1">
                            <Label htmlFor="external" className="font-semibold flex items-center gap-2 cursor-pointer">
                                <Shield className="w-4 h-4 text-green-500" /> {t("External OAuth (OIDC)")}
                            </Label>
                            <p className="text-sm text-muted-foreground">{t("Patrons authenticate via an external OIDC provider (e.g. Auth0, Keycloak).")}</p>
                            {!data?.external_auth_ready && (
                                <p className="text-xs font-semibold text-red-500 mt-1">{t("Configure OIDC provider first.")}</p>
                            )}
                        </div>
                    </div>
                </RadioGroup>

                <div className="pt-4 flex items-center gap-4 border-t">
                    <Button onClick={handleSave} disabled={mutation.isPending || mode === data?.lending_mode}>
                        {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {t("Save Configuration")}
                    </Button>
                    {saveSuccess && <span className="text-sm text-green-600 font-medium animate-in fade-in">{t("Saved successfully!")}</span>}
                </div>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm">
                <IaAuthToggle initialEnabled={data?.ia_auth_enabled} />
            </div>
            
            <div className="pt-4">
                <Button variant="outline" asChild>
                    <Link href="/settings">{t("Back to Settings")}</Link>
                </Button>
            </div>
        </div>
    )
}
