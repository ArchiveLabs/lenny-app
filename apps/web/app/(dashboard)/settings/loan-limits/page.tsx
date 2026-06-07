"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { Loader2, Save, Clock, AlertCircle } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { ErrorState } from "@/components/ErrorState"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import { LoanLimitsConfig, LoanLimitsConfigSchema } from "@/types/api"

export default function LoanLimitsPage() {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [config, setConfig] = useState<Record<string, number | string>>({})
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)

    const { data, isLoading, error } = useQuery({
        queryKey: ["loan-limits"],
        queryFn: async () => {
            const res = await fetchAdmin("settings/loan-limits")
            return handleApiResponse<LoanLimitsConfig>(res, LoanLimitsConfigSchema)
        },
    })

    const lastConfigRef = useRef<string | null>(null)

    useEffect(() => {
        if (data) {
            const dataHash = JSON.stringify(data)
            if (dataHash !== lastConfigRef.current) {
                setConfig(data as unknown as Record<string, number | string>)
                lastConfigRef.current = dataHash
            }
        }
    }, [data])

    const mutation = useMutation({
        mutationFn: async (newConfig: Partial<LoanLimitsConfig>) => {
            const res = await fetchAdmin("settings/loan-limits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newConfig)
            })
            return handleApiResponse<LoanLimitsConfig>(res, LoanLimitsConfigSchema)
        },
        onSuccess: (updated) => {
            setSaveSuccess(true)
            setConfig(updated as unknown as Record<string, number | string>)
            queryClient.invalidateQueries({ queryKey: ["loan-limits"] })
            setTimeout(() => setSaveSuccess(false), 3000)
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
        return <ErrorState message={t("Failed to load loan limits configuration.")} />
    }

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault()
        setValidationError(null)
        
        const maxConcurrent = config.max_concurrent_loans
        const maxDuration = config.max_loan_duration_days

        if (typeof maxConcurrent !== "number" || isNaN(maxConcurrent) || maxConcurrent < 1) {
            setValidationError(t("Maximum Concurrent Loans must be a valid number greater than or equal to 1."))
            return
        }

        if (typeof maxDuration !== "number" || isNaN(maxDuration) || maxDuration < 0) {
            setValidationError(t("Maximum Loan Duration must be a valid number greater than or equal to 0."))
            return
        }

        const payload: Partial<LoanLimitsConfig> = {
            max_concurrent_loans: maxConcurrent,
            max_loan_duration_days: maxDuration,
        }
        
        mutation.mutate(payload)
    }

    const handleNumberChange = (field: string, val: string) => {
        if (val === "") {
            setConfig(prev => ({ ...prev, [field]: "" }))
            return
        }
        const num = parseInt(val, 10)
        if (!isNaN(num)) {
            const min = field === "max_concurrent_loans" ? 1 : 0
            if (num >= min) {
                setConfig(prev => ({ ...prev, [field]: num }))
            }
        }
    }

    return (
        <div className="max-w-2xl space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">{t("Loan Limits")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("Configure global policies for patron borrowing.")}</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="max_concurrent_loans">{t("Maximum Concurrent Loans")}</Label>
                            <Input 
                                id="max_concurrent_loans" 
                                type="number"
                                min="1"
                                max="100"
                                value={config.max_concurrent_loans ?? ""}
                                onChange={(e) => handleNumberChange("max_concurrent_loans", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">{t("The maximum number of books a single patron can borrow at the same time.")}</p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="max_loan_duration_days">{t("Maximum Loan Duration (Days)")}</Label>
                            <Input 
                                id="max_loan_duration_days" 
                                type="number"
                                min="0"
                                max="365"
                                value={config.max_loan_duration_days ?? ""}
                                onChange={(e) => handleNumberChange("max_loan_duration_days", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">{t("How long a patron can borrow a book before it is automatically returned. 0 means never expires / no auto-return.")}</p>
                        </div>


                    </div>

                    <div className="pt-4 flex flex-col gap-4 border-t">
                        {validationError && (
                            <div className="flex items-center gap-2 text-sm text-red-500 font-medium">
                                <AlertCircle className="w-4 h-4" />
                                {validationError}
                            </div>
                        )}
                        {mutation.error && (
                            <div className="flex items-center gap-2 text-sm text-red-500 font-medium">
                                <AlertCircle className="w-4 h-4" />
                                {mutation.error.message}
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                {t("Save Limits")}
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
