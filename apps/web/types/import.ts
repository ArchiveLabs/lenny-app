import { z } from "zod"

// Mirrors the lenny API contract for import batches (/admin/import/batches).
export const ImportRowStateSchema = z.enum([
  "queued", "matched", "needs_review", "no_match", "duplicate",
  "not_epub", "importing", "imported", "failed",
])
export type ImportRowState = z.infer<typeof ImportRowStateSchema>

export const ImportDecisionSchema = z.enum(["auto", "user"])
export type ImportDecision = z.infer<typeof ImportDecisionSchema>

export const BatchMatchSchema = z.object({
  id: z.string(),
  status: z.enum(["queued", "running", "done", "failed"]),
  total: z.number(),
  done: z.number(),
  error: z.string().nullish(),
  retry_after: z.number().nullish(), // seconds
})
export type BatchMatch = z.infer<typeof BatchMatchSchema>

// The server-side import of a batch: one job at a time, kept while the server process lives.
export const ImportJobSchema = z.object({
  id: z.string(),
  status: z.enum(["queued", "running", "done", "failed"]),
  total: z.number(),
  done: z.number(),
  imported: z.number().default(0),
  duplicate: z.number().default(0),
  failed: z.number().default(0),
  waiting: z.number().default(0), // ready rows whose file has not reached the server
  error: z.string().nullish(),
})
export type ImportJob = z.infer<typeof ImportJobSchema>
export const isImportActive = (j: Pick<ImportJob, "status"> | null | undefined) => j?.status === "queued" || j?.status === "running"

export const ImportBatchSummarySchema = z.object({
  id: z.number(),
  created_at: z.string(),
  expires_at: z.string(),
  total: z.number(),
  counts: z.record(z.string(), z.number()),
  skipped: z.number().default(0),
  encrypted: z.number().default(0),
  ready: z.number().default(0), // matched and not skipped
  auto_picked: z.number().default(0),
  staged: z.number().default(0), // matched rows whose file is already on the server
  unstaged: z.number().default(0), // matched, not skipped, file not sent yet
  match: BatchMatchSchema.nullish(), // latest match job; null after a server restart
  import: ImportJobSchema.nullish(), // newest import job; null before the first and after a server restart
})
export type ImportBatchSummary = z.infer<typeof ImportBatchSummarySchema>

export const LibrarySyncSchema = z.object({
  reverted: z.number().default(0), // duplicate rows whose book was deleted, matched again
  released: z.number().default(0), // imported rows that let go of their key
  removed_from_library: z.number().default(0),
})

export const ImportBatchListSchema = z.object({ batches: z.array(ImportBatchSummarySchema) })

export const ImportRowSchema = z.object({
  id: z.number(),
  path: z.string(),
  size: z.number(),
  mtime: z.number(),
  state: ImportRowStateSchema,
  decision: ImportDecisionSchema,
  skipped: z.boolean().default(false),
  olid: z.number().nullish(),
  auto_picked: z.boolean().default(false),
  candidates_count: z.number().default(0),
  confidence: z.number().nullish(), // 0-100
  encrypted: z.boolean().default(false),
  staged: z.boolean().default(false), // the file is on the server
  imported_at: z.string().nullish(), // ISO time the book was imported; null until then
  in_library: z.boolean().default(true), // whether the book is in the Lenny library right now
  isbn: z.string().nullish(),
  isbn_alt: z.string().nullish(), // more ISBNs from the EPUB, space separated
  title: z.string().nullish(), // from the EPUB
  author: z.string().nullish(),
  match_title: z.string().nullish(), // from the Open Library record
  match_author: z.string().nullish(),
  match_year: z.number().nullish(), // from the Open Library edition; `year` is the EPUB's own
  language: z.string().nullish(),
  publisher: z.string().nullish(),
  year: z.number().nullish(),
  error: z.string().nullish(),
})
export type ImportRow = z.infer<typeof ImportRowSchema>

export const ImportCandidateSchema = z.object({
  olid: z.number(),
  title: z.string().nullish(),
  authors: z.array(z.string()).default([]),
  year: z.number().nullish(),
  publisher: z.string().nullish(),
  language: z.string().nullish(),
  isbn: z.string().nullish(),
  score: z.number().nullish(),
  in_library: z.boolean().default(false),
})
export type ImportCandidate = z.infer<typeof ImportCandidateSchema>

export const ImportRowPageSchema = z.object({
  rows: z.array(ImportRowSchema),
  next_cursor: z.string().nullable(),
  total: z.number().nullish(), // rows matching the filters, ignoring offset and limit
})
export type ImportRowPage = z.infer<typeof ImportRowPageSchema>

/** Rows the "Import N books" button will send: matched and not skipped. */
export const isReady = (r: Pick<ImportRow, "state" | "skipped">) =>
  r.state === "matched" && !r.skipped

/** Blocking row states: the admin has to act before these can be imported. */
export const needsAction = (r: Pick<ImportRow, "state">) =>
  r.state === "needs_review" || r.state === "no_match"

// #246: matching job, candidates, edition lookup, limits.
export const MatchJobSchema = z.object({
  id: z.string(),
  batch_id: z.number(),
  status: z.enum(["queued", "running", "done", "failed"]),
  total: z.number(),
  done: z.number(),
  error: z.string().nullish(),
})
export type MatchJob = z.infer<typeof MatchJobSchema>

export const ImportCandidatesSchema = z.object({ candidates: z.array(ImportCandidateSchema) })

export const EditionLookupSchema = z.object({
  olid: z.number(),
  title: z.string().nullish(),
  publisher: z.string().nullish(),
  year: z.number().nullish(),
  isbn: z.string().nullish(),
  in_library: z.boolean().default(false),
})
export type EditionLookup = z.infer<typeof EditionLookupSchema>

export const DuplicateCheckSchema = z.object({ existing: z.array(z.number()) })

export const ImportLimitsSchema = z.object({
  max_rows_per_call: z.number(),
  isbn_batch: z.number(),
  ol_requests_per_second: z.number().nullish(),
  ol_identified: z.boolean().default(false),
  ol_logged_in: z.boolean().default(false),
  max_file_mb: z.number(),
  upload_concurrency: z.number(),
  retention_days: z.number(),
  formats: z.array(z.string()),
})
export type ImportLimits = z.infer<typeof ImportLimitsSchema>

export const isJobActive = (j: Pick<MatchJob, "status">) => j.status === "queued" || j.status === "running"
