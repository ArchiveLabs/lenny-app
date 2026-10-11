"use client"

import { useTranslation } from "react-i18next"
import { CheckCircle2, ExternalLink } from "lucide-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import type { ImportRow } from "@/types/import"
import { editionKey } from "./RowItem"

export const openLibraryUrl = (olid: number) => `https://openlibrary.org/books/${editionKey(olid)}`

export const fileSize = (bytes: number) =>
  bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const STATUS: Record<ImportRow["state"], { label: string; className: string }> = {
  queued: { label: "Waiting to match", className: "text-muted-foreground" },
  matched: { label: "Matched", className: "border-green-300 text-green-700" },
  needs_review: { label: "Needs review", className: "border-amber-300 text-amber-700" },
  no_match: { label: "No match", className: "border-red-300 text-red-700" },
  duplicate: { label: "Already in the library", className: "text-muted-foreground" },
  not_epub: { label: "Not an EPUB", className: "text-muted-foreground" },
  importing: { label: "Importing", className: "border-blue-300 text-blue-700" },
  imported: { label: "Imported", className: "border-green-300 text-green-700" },
  failed: { label: "Failed", className: "border-red-300 text-red-700" },
}

const empty = (v: React.ReactNode) => v === null || v === undefined || v === "" || v === false

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (empty(children)) return null
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className="divide-y">{children}</dl>
    </section>
  )
}

/** Everything the page knows about one book, read-only. */
export function RowDetails({ row, onClose, onChangeEdition }: { row: ImportRow | null; onClose: () => void; onChangeEdition: (r: ImportRow) => void }) {
  const { t } = useTranslation()
  const canChange = !!row && !["imported", "not_epub", "importing", "duplicate"].includes(row.state)
  const status = row && STATUS[row.state]
  const dash = <span className="text-muted-foreground">—</span>

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        {row && status && (
          <>
            <SheetHeader className="space-y-2 border-b">
              <SheetTitle className="pr-8 leading-snug">{row.match_title || row.title || row.path.split("/").pop()}</SheetTitle>
              <SheetDescription className="line-clamp-2">{row.match_author || row.author}</SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="outline" className={status.className}>{t(status.label)}</Badge>
                {row.olid ? (
                  <Badge asChild variant="outline" className="gap-1 border-green-300 text-green-700">
                    <a href={openLibraryUrl(row.olid)} target="_blank" rel="noopener noreferrer" title={t("Linked to Open Library")}>
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      {editionKey(row.olid)}
                    </a>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">{t("Not linked yet")}</Badge>
                )}
                {row.olid && row.auto_picked && row.confidence != null && <Badge variant="secondary">{t("{{n}}% match", { n: Math.round(row.confidence) })}</Badge>}
                {row.olid && !row.auto_picked && <Badge variant="secondary">{t("Chosen by you")}</Badge>}
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              {row.error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-inherit">{row.error}</AlertDescription>
                </Alert>
              )}

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Compare")}</h3>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20" />
                        <TableHead>{t("In the file")}</TableHead>
                        <TableHead>{t("On Open Library")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-muted-foreground">{t("Title")}</TableCell>
                        <TableCell className="whitespace-normal break-words">{row.title || dash}</TableCell>
                        <TableCell className="whitespace-normal break-words">{row.match_title || dash}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground">{t("Author")}</TableCell>
                        <TableCell className="whitespace-normal break-words">{row.author || dash}</TableCell>
                        <TableCell className="whitespace-normal break-words">{row.match_author || dash}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-muted-foreground">{t("Year")}</TableCell>
                        <TableCell>{row.year || dash}</TableCell>
                        <TableCell>{row.match_year || dash}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                {row.candidates_count > 0 && (
                  <p className="text-xs text-muted-foreground">{t("{{n}} other editions were suggested.", { n: row.candidates_count })}</p>
                )}
              </section>

              <Group title={t("Details from the file")}>
                <Field label={t("Publisher")}>{row.publisher}</Field>
                <Field label={t("ISBN")}>{row.isbn}</Field>
                <Field label={t("Language")}>{row.language}</Field>
              </Group>

              <Separator />

              <Group title={t("File")}>
                <Field label={t("Path")}>{row.path}</Field>
                <Field label={t("Size")}>{fileSize(row.size)}</Field>
                <Field label={t("Modified")}>{new Date(row.mtime).toLocaleString()}</Field>
                <Field label={t("Uploaded")}>{row.state === "matched" ? (row.staged ? t("Yes, it is on the server") : t("Not yet")) : null}</Field>
                <Field label={t("Encrypted")}>{row.encrypted ? t("Yes: readers must log in") : t("No")}</Field>
              </Group>
            </div>

            {(canChange || row.olid) && (
              <SheetFooter className="flex-row flex-wrap gap-2 border-t">
                {canChange && (
                  <Button onClick={() => onChangeEdition(row)}>{row.olid ? t("Change edition") : t("Choose edition")}</Button>
                )}
                {row.olid && (
                  <Button asChild variant="outline">
                    <a href={openLibraryUrl(row.olid)} target="_blank" rel="noopener noreferrer">
                      {t("View on Open Library")}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </Button>
                )}
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
