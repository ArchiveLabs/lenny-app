import { z } from "zod"

// Mirrors the lenny API contract for import batches (/admin/import/batches).
export const ImportRowStateSchema = z.enum([
  "queued", "matched", "needs_review", "no_match", "duplicate",
  "not_epub", "importing", "imported", "failed",
])
export type ImportRowState = z.infer<typeof ImportRowStateSchema>

export const ImportDecisionSchema = z.enum(["auto", "user"])
export type ImportDecision = z.infer<typeof ImportDecisionSchema>

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
})
export type ImportBatchSummary = z.infer<typeof ImportBatchSummarySchema>

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
  isbn: z.string().nullish(),
  title: z.string().nullish(), // from the EPUB
  author: z.string().nullish(),
  match_title: z.string().nullish(), // from the Open Library record
  match_author: z.string().nullish(),
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
})
export type ImportCandidate = z.infer<typeof ImportCandidateSchema>

export const ImportRowPageSchema = z.object({
  rows: z.array(ImportRowSchema),
  next_cursor: z.string().nullable(),
})
export type ImportRowPage = z.infer<typeof ImportRowPageSchema>

/** Rows the "Import N books" button will send: matched and not skipped. */
export const isReady = (r: Pick<ImportRow, "state" | "skipped">) =>
  r.state === "matched" && !r.skipped

/** Blocking row states: the admin has to act before these can be imported. */
export const needsAction = (r: Pick<ImportRow, "state">) =>
  r.state === "needs_review" || r.state === "no_match"
