"use client"

import { ReactNode, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { BookOpen, Loader2, Trash2, ChevronDown } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
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
import { EncryptionToggle } from "@/components/UploadComponents"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { ApiError, LennyBook, LoanLimitsConfig, LoanLimitsConfigSchema } from "@/types/api"
import { LIBRARY_QUERY_KEY, removeBooksFromLibraryCache } from "@/lib/query-client"
import { useTranslation } from "react-i18next"

export function BookEditSheet({ book, children }: { book: LennyBook; children: ReactNode }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [encrypted, setEncrypted] = useState(book.lenny.encrypted)
  const [loanDuration, setLoanDuration] = useState(
    book.lenny.loan_duration_days != null ? String(book.lenny.loan_duration_days) : ""
  )
  const [newEdition, setNewEdition] = useState("")
  const [reuploadFile, setReuploadFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cheap settings call (not the slow /admin/items) — used to cap the per-book
  // override so nobody can set a loan longer than the site's own global max.
  const { data: loanLimits } = useQuery({
    queryKey: ["loan-limits"],
    queryFn: async () => {
      const res = await fetchAdmin("settings/loan-limits")
      return handleApiResponse<LoanLimitsConfig>(res, LoanLimitsConfigSchema)
    },
    enabled: open,
    staleTime: 5 * 60_000,
  })
  const maxLoanDays = loanLimits?.max_loan_duration_days
  const loanDurationValue = loanDuration.trim() === "" ? null : Number(loanDuration)
  const loanDurationIsNegative = loanDurationValue !== null && loanDurationValue < 0
  const loanDurationExceedsMax =
    !!maxLoanDays && loanDurationValue !== null && loanDurationValue > maxLoanDays
  const loanDurationInvalid = loanDurationIsNegative || loanDurationExceedsMax

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = loanDuration.trim()
      const res = await fetchAdmin(`items/${book.lenny.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encrypted,
          loan_duration_days: trimmed === "" ? null : Number(trimmed),
        }),
      })
      return handleApiResponse(res)
    },
    onSuccess: () => {
      toast.success(t("Book updated"))
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY })
      setOpen(false)
    },
    onError: (err: ApiError) => {
      toast.error(err?.message || t("Failed to update book"))
    },
  })

  const deleteBook = useMutation({
    mutationFn: async () => {
      const res = await fetchAdmin(`items/${book.olid}`, { method: "DELETE" })
      return handleApiResponse(res)
    },
    onSuccess: () => {
      toast.success(t("Deleted {{title}}", { title: book.title }))
      // We already know exactly which book left — remove it from the cached list
      // in place. No need to make the slow /admin/items round-trip just to confirm
      // what we already know, and no loading flicker for something already correct.
      removeBooksFromLibraryCache([book.olid])
      setOpen(false)
    },
    onError: (err: ApiError) => {
      toast.error(err?.message || t("Failed to delete book"))
      // Here we can't trust the cache either way — re-sync with the backend.
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY })
    },
  })

  const updateEdition = useMutation({
    mutationFn: async () => {
      const digits = newEdition.replace(/\D/g, "")
      if (!digits) throw new ApiError(t("Enter a valid OpenLibrary edition key"))
      const res = await fetchAdmin(`items/${book.olid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openlibrary_edition: Number(digits) }),
      })
      return handleApiResponse(res)
    },
    onSuccess: () => {
      toast.success(t("Edition key updated. The book now lives under its new key."))
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY })
      setOpen(false)
    },
    onError: (err: ApiError) => {
      toast.error(err?.message || t("Failed to update edition key"))
    },
  })

  const reupload = useMutation({
    mutationFn: async () => {
      if (!reuploadFile) throw new ApiError(t("Choose a file first"))
      const formData = new FormData()
      formData.append("file", reuploadFile)
      formData.append("encrypted", encrypted ? "true" : "false")
      const res = await fetchAdmin(`items/${book.olid}/reupload`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        throw new ApiError(errText, res.status)
      }
    },
    onSuccess: () => {
      toast.success(t("File replaced"))
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY })
      setReuploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      setOpen(false)
    },
    onError: (err: ApiError) => {
      toast.error(err?.message || t("Failed to replace file"))
    },
  })

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          // Reset to the book's current values each time the sheet opens
          setEncrypted(book.lenny.encrypted)
          setLoanDuration(book.lenny.loan_duration_days != null ? String(book.lenny.loan_duration_days) : "")
          setNewEdition("")
          setReuploadFile(null)
        }
        setOpen(next)
      }}
    >
      <SheetTrigger asChild>
        <div className="cursor-pointer">{children}</div>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-muted/50">
              {book.cover_i ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`}
                  alt={`${book.title} cover`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-5 w-5 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="min-w-0 pt-0.5">
              <SheetTitle className="line-clamp-2 text-left">{book.title}</SheetTitle>
              <SheetDescription className="line-clamp-1 text-left">
                {book.author_name?.join(", ") || t("Unknown Author")}
              </SheetDescription>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {book.olid}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t("{{count}} copies", { count: book.lenny.available_copies })}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          <div className="space-y-4 rounded-lg border border-border/60 p-4">
            <div className="space-y-2">
              <Label>{t("Access")}</Label>
              <EncryptionToggle isEncrypted={encrypted} onToggle={() => setEncrypted((v) => !v)} />
              <p className="text-xs text-muted-foreground">
                {t("Controls which stored file variant gets served when this book is borrowed.")}
              </p>
            </div>

            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label htmlFor="loan-duration">{t("Loan duration (days)")}</Label>
              <Input
                id="loan-duration"
                type="number"
                min={0}
                max={maxLoanDays || undefined}
                placeholder={t("Use global default")}
                value={loanDuration}
                onChange={(e) => setLoanDuration(e.target.value)}
                aria-invalid={loanDurationInvalid}
              />
              <p className="text-xs text-muted-foreground">
                {t("Leave blank to use the global loan duration setting.")}
                {!!maxLoanDays && ` ${t("Site max is {{max}} days.", { max: maxLoanDays })}`}
              </p>
              {loanDurationExceedsMax && (
                <p className="text-xs font-medium text-destructive">
                  {t("Can't exceed the site-wide max of {{max}} days.", { max: maxLoanDays })}
                </p>
              )}
              {loanDurationIsNegative && (
                <p className="text-xs font-medium text-destructive">
                  {t("Can't be negative. Use 0 for never expires.")}
                </p>
              )}
            </div>
          </div>

          <details className="group rounded-lg border border-border/60">
            <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
              {t("Wrong edition or file attached?")}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>

            <div className="space-y-4 px-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="new-edition" className="text-xs font-normal text-muted-foreground">
                  {t("Correct OpenLibrary edition key")}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="new-edition"
                    placeholder={book.olid}
                    value={newEdition}
                    onChange={(e) => setNewEdition(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 font-semibold"
                    disabled={!newEdition.trim() || updateEdition.isPending}
                    onClick={() => updateEdition.mutate()}
                  >
                    {updateEdition.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t("Update")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("Moves this book's files to the new key. The item and its loans stay the same.")}
                </p>
              </div>

              <div className="space-y-2 border-t border-border/50 pt-4">
                <Label className="text-xs font-normal text-muted-foreground">
                  {t("Replacement file (EPUB or PDF)")}
                </Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".epub,.pdf"
                    onChange={(e) => setReuploadFile(e.target.files?.[0] ?? null)}
                    className="flex-1 min-w-0 rounded-md border border-input bg-transparent text-xs text-muted-foreground file:mr-2 file:h-full file:border-0 file:border-r file:border-input file:bg-muted file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 font-semibold"
                    disabled={!reuploadFile || reupload.isPending}
                    onClick={() => reupload.mutate()}
                  >
                    {reupload.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t("Replace")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("Keeps this item's id and loan history. Only the file changes.")}
                </p>
              </div>
            </div>
          </details>

          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <Label className="text-destructive">{t("Danger zone")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("Permanently deletes this book's files and database record. This cannot be undone.")}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="font-semibold">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  {t("Delete Book")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("Delete “{{title}}”?", { title: book.title })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("This permanently removes the book's files and database record, and cancels any active loans on it. This cannot be undone.")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={deleteBook.isPending}
                    onClick={() => deleteBook.mutate()}
                  >
                    {deleteBook.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t("Delete Permanently")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <SheetFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending || loanDurationInvalid} className="w-full font-semibold">
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("Save Changes")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
