import { z } from "zod"

// Mirrors the lenny API contract for import batches (/admin/import/batches).
export const ImportRowStateSchema = z.enum([
  "queued", "matched", "needs_review", "no_match", "duplicate",
  "not_epub", "importing", "imported", "failed",
])
export type ImportRowState = z.infer<typeof ImportRowStateSchema>

export const ImportDecisionSchema = z.enum(["auto", "user", "skip"])
export type ImportDecision = z.infer<typeof ImportDecisionSchema>

export const ImportBatchSummarySchema = z.object({
  id: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
  total: z.number(),
  counts: z.record(z.string(), z.number()),
  skipped: z.number().default(0),
  encrypted: z.number().default(0),
})
export type ImportBatchSummary = z.infer<typeof ImportBatchSummarySchema>

export const ImportBatchListSchema = z.object({ batches: z.array(ImportBatchSummarySchema) })

export const ImportRowSchema = z.object({
  id: z.string(),
  path: z.string(),
  size: z.number(),
  mtime: z.number(),
  state: ImportRowStateSchema,
  decision: ImportDecisionSchema,
  olid: z.number().nullish(),
  auto_picked: z.boolean().default(false),
  candidates_count: z.number().default(0),
  confidence: z.number().nullish(), // 0-100
  encrypted: z.boolean().default(false),
  isbn: z.string().nullish(),
  title: z.string().nullish(),
  author: z.string().nullish(),
  language: z.string().nullish(),
  publisher: z.string().nullish(),
  year: z.union([z.number(), z.string()]).nullish(),
  error: z.string().nullish(),
})
export type ImportRow = z.infer<typeof ImportRowSchema>

export const ImportRowPageSchema = z.object({
  rows: z.array(ImportRowSchema),
  next_cursor: z.string().nullable(),
})
export type ImportRowPage = z.infer<typeof ImportRowPageSchema>

/** Rows the "Import N books" button will send: matched and not skipped. */
export const isReady = (r: Pick<ImportRow, "state" | "decision">) =>
  r.state === "matched" && r.decision !== "skip"

/** Blocking row states: the admin has to act before these can be imported. */
export const needsAction = (r: Pick<ImportRow, "state">) =>
  r.state === "needs_review" || r.state === "no_match"
