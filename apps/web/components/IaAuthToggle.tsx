"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { toast } from "sonner"
import { ApiError } from "@/types/api"
import { useTranslation } from "react-i18next"
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

interface IaAuthToggleProps {
    initialEnabled?: boolean;
}

export function IaAuthToggle({ initialEnabled = false }: IaAuthToggleProps) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [enabled, setEnabled] = useState(initialEnabled)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [pendingState, setPendingState] = useState(false)

    useEffect(() => {
        setEnabled(initialEnabled)
    }, [initialEnabled])

    const mutation = useMutation({
        mutationFn: async (newEnabled: boolean) => {
            const res = await fetchAdmin("ia-auth/toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: newEnabled })
            })
            return handleApiResponse(res)
        }
    })

    const handleToggle = async (checked: boolean) => {
        setEnabled(checked)
        try {
            await mutation.mutateAsync(checked)
            toast.success(t("Saved successfully!"))
            await queryClient.refetchQueries({ queryKey: ["auth-mode"] })
        } catch (err: any) {
            setEnabled(!checked)
            if (err instanceof ApiError && err.status === 422) {
                toast.error(err.message)
            } else {
                toast.error(err.message || t("Failed to save configuration"))
            }
        }
    }

    const handleCheckboxChange = (checked: boolean) => {
        setPendingState(checked)
        setDialogOpen(true)
    }

    const confirmToggle = () => {
        handleToggle(pendingState)
    }

    return (
        <div className="flex items-center space-x-2">
            <Checkbox 
                id="ia_auth_enabled" 
                checked={enabled}
                onCheckedChange={(checked) => handleCheckboxChange(checked === true)}
                disabled={mutation.isPending}
            />
            <div className="grid gap-1.5 leading-none">
                <Label htmlFor="ia_auth_enabled">{t("IA S3 Patron Auth")}</Label>
                <p className="text-sm text-muted-foreground">
                    {t("Allow patrons to authenticate using their Internet Archive S3 credentials")}
                </p>
            </div>

            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingState ? t("Enable IA S3 Patron Auth?") : t("Disable IA S3 Patron Auth?")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingState
                                ? t("This will immediately allow patrons to log in using their Internet Archive S3 credentials.")
                                : t("This will immediately prevent patrons from logging in using their Internet Archive S3 credentials.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmToggle}>
                            {t("Confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
