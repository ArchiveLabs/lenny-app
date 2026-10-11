"use client"

import { useTranslation } from "react-i18next"
import { ExternalLink } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import type { ImportRow } from "@/types/import"
import { editionKey } from "./RowItem"

export const openLibraryUrl = (olid: number) => `https://openlibrary.org/books/${editionKey(olid)}`

export const fileSize = (bytes: number) =>
  bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const STATUS: Record<ImportRow["state"], string> = {
  queued: "Waiting to match",
  matched: "Matched",
  needs_review: "Needs review",
  no_match: "No match",
  duplicate: "Already in the library",
  not_epub: "Not an EPUB",
  importing: "Importing",
  imported: "Imported",
  failed: "Failed",
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "" || children === false) return null
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  )
}

/** Everything the page knows about one book, read-only. */
export function RowDetails({ row, onClose, onChangeEdition }: { row: ImportRow | null; onClose: () => void; onChangeEdition: (r: ImportRow) => void }) {
  const { t } = useTranslation()
  const canChange = !!row && row.state !== "imported" && row.state !== "not_epub" && row.state !== "importing" && row.state !== "duplicate"
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle>{row.match_title || row.title || row.path.split("/").pop()}</SheetTitle>
              <SheetDescription>{t(STATUS[row.state])}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <Group title={t("Open Library")}>
                <Field label={t("Edition")}>
                  {row.olid ? (
                    <a href={openLibraryUrl(row.olid)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                      {editionKey(row.olid)}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : (
                    t("Not linked yet")
                  )}
                </Field>
                <Field label={t("Title")}>{row.match_title}</Field>
                <Field label={t("Author")}>{row.match_author}</Field>
                <Field label={t("Chosen")}>
                  {row.olid ? (row.auto_picked ? t("Picked automatically") : t("Chosen by you")) : null}
                </Field>
                <Field label={t("Match")}>{row.olid && row.auto_picked && row.confidence != null ? `${Math.round(row.confidence)}%` : null}</Field>
                <Field label={t("Suggestions")}>{row.candidates_count > 0 ? row.candidates_count : null}</Field>
              </Group>

              <Group title={t("From the file")}>
                <Field label={t("Title")}>{row.title}</Field>
                <Field label={t("Author")}>{row.author}</Field>
                <Field label={t("ISBN")}>{row.isbn}</Field>
                <Field label={t("Publisher")}>{row.publisher}</Field>
                <Field label={t("Year")}>{row.year}</Field>
                <Field label={t("Language")}>{row.language}</Field>
              </Group>

              <Group title={t("File")}>
                <Field label={t("Path")}>{row.path}</Field>
                <Field label={t("Size")}>{fileSize(row.size)}</Field>
                <Field label={t("Modified")}>{new Date(row.mtime).toLocaleString()}</Field>
                <Field label={t("Uploaded")}>{row.state === "matched" ? (row.staged ? t("Yes, it is on the server") : t("Not yet")) : null}</Field>
                <Field label={t("Encrypted")}>{row.encrypted ? t("Yes: readers must log in") : t("No")}</Field>
              </Group>

              {row.error && <p role="alert" className="text-sm text-red-700">{row.error}</p>}

              {canChange && (
                <Button variant="outline" onClick={() => onChangeEdition(row)}>
                  {row.olid ? t("Change edition") : t("Choose edition")}
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
