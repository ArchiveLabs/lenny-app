import { Shield, ShieldAlert, UploadCloud, X, FileType, Plus, Loader2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
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

export function FileAttachment({ file, onRemove }: { file?: File, onRemove: (e?: React.MouseEvent) => void }) {
    if (!file) return null;
    return (
        <div className="flex items-center justify-end gap-1 text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/20 py-1 pl-2 pr-0.5 rounded-lg ml-auto max-w-fit">
            <FileType className="w-3 h-3 shrink-0 opacity-70" />
            <span className="text-[10px] font-semibold truncate max-w-[70px]">{file.name}</span>
            <Button variant="ghost" className="h-5 w-5 p-0 rounded shrink-0 hover:text-red-600 transition-colors" onClick={onRemove}>
                <X className="h-3 w-3" />
            </Button>
        </div>
    )
}

export function FileDropzone({ onFile }: { onFile: (file: File) => void }) {
    const { t } = useTranslation()
    return (
        <div className="group relative inline-flex ml-auto">
            <Input type="file" accept=".epub" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = '' }}
            />
            <Button variant="outline" size="sm" className="h-7 text-[11px] font-semibold relative z-10 px-3 group-hover:border-primary/50 group-hover:bg-primary/5 transition-all">
                <UploadCloud className="w-3 h-3 mr-1.5 opacity-70" /> {t("Attach")}
            </Button>
        </div>
    )
}

export function EditionInput({
    value, onChange, onSubmit, isLoading, error
}: {
    value: string, onChange: (val: string) => void, onSubmit: (e: React.FormEvent) => void, isLoading: boolean, error?: string
}) {
    const { t } = useTranslation()
    return (
        <div className="flex flex-col relative">
            <form onSubmit={onSubmit} className="flex relative">
                <Input 
                    className={`h-9 pr-9 w-[180px] lg:w-[220px] rounded-lg border-dashed transition-colors bg-muted/20 ${error ? "border-red-500 hover:border-red-500 focus-visible:ring-red-500/30" : "hover:border-primary/50"}`} 
                    placeholder={t("Add Edition manually...")} 
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    disabled={isLoading}
                />
                <Button type="submit" size="icon" variant="ghost" disabled={isLoading} className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
            </form>
            {error && (
                <span className="absolute -bottom-5 right-0 text-[10px] text-red-500 font-medium whitespace-nowrap">{error}</span>
            )}
        </div>
    )
}
