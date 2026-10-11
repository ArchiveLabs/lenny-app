import { Shield, ShieldAlert } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { useTranslation } from "react-i18next"

export function EncryptionToggle({ isEncrypted, onToggle }: { isEncrypted: boolean, onToggle: () => void }) {
    const { t } = useTranslation()
    return (
        <Button 
            variant="outline" size="sm"
            type="button"
            onClick={onToggle}
            className={`h-7 px-2 rounded transition-all text-[10px] font-bold uppercase tracking-wider ${isEncrypted ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400" : "text-muted-foreground border-muted-foreground/20 hover:text-foreground"}`}
        >
            {isEncrypted ? <Shield className="h-3 w-3 mr-1" /> : <ShieldAlert className="h-3 w-3 mr-1 opacity-60" />}
            {isEncrypted ? t("On") : t("Off")}
        </Button>
    )
}
