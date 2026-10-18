import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Label } from "@workspace/ui/components/label"

type Aria = { id: string; "aria-invalid": boolean; "aria-required": boolean; "aria-describedby": string | undefined }

/** Label with a required mark, the input, then one line below it: an error, else a good-to-go note, else a hint. */
export function FormField({ id, label, required = true, hint, ok, error, children }: {
  id: string
  label: string
  required?: boolean
  hint?: React.ReactNode
  ok?: string
  error?: string
  children: (aria: Aria) => React.ReactNode
}) {
  const noteId = `${id}-note`
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        <span>
          {label}
          {required && <span aria-hidden className="ml-0.5 text-destructive">*</span>}
        </span>
      </Label>
      {children({ id, "aria-invalid": !!error, "aria-required": required, "aria-describedby": error || ok || hint ? noteId : undefined })}
      {error ? (
        <p id={noteId} role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />{error}
        </p>
      ) : ok ? (
        <p id={noteId} className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />{ok}
        </p>
      ) : hint ? (
        <div id={noteId} className="text-sm text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  )
}
