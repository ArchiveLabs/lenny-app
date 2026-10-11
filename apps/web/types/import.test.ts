// @ts-nocheck
import {
  EditionLookupSchema, ImportBatchSummarySchema, ImportCandidateSchema, ImportLimitsSchema, ImportRowPageSchema,
  MatchJobSchema, isJobActive, isReady, needsAction,
} from "./import"

const row = { id: 1, path: "books/x.epub", size: 10, mtime: 1, state: "matched", decision: "auto" }

describe("import contract schemas", () => {
  it("parses a row page and fills defaults", () => {
    const page = ImportRowPageSchema.parse({ rows: [row], next_cursor: null })
    expect(page.rows[0]).toMatchObject({ auto_picked: false, candidates_count: 0, encrypted: false, skipped: false })
  })

  it("rejects an unknown state", () => {
    expect(() => ImportRowPageSchema.parse({ rows: [{ ...row, state: "weird" }], next_cursor: null })).toThrow()
  })

  it("parses a batch summary", () => {
    const s = ImportBatchSummarySchema.parse({ id: 7, created_at: "t", expires_at: "t", total: 2, counts: { matched: 2 } })
    expect(s).toMatchObject({ skipped: 0, ready: 0, auto_picked: 0 })
  })

  it("ready = matched and not skipped; needs action = needs_review or no_match", () => {
    expect(isReady({ state: "matched", skipped: false })).toBe(true)
    expect(isReady({ state: "matched", skipped: true })).toBe(false)
    expect(isReady({ state: "needs_review", skipped: false })).toBe(false)
    expect(needsAction({ state: "no_match" })).toBe(true)
    expect(needsAction({ state: "matched" })).toBe(false)
  })

  it("rejects the old skip decision value and parses a candidate", () => {
    expect(() => ImportRowPageSchema.parse({ rows: [{ ...row, decision: "skip" }], next_cursor: null })).toThrow()
    expect(ImportCandidateSchema.parse({ olid: 5 }).authors).toEqual([])
  })
})

describe("#246 schemas", () => {
  it("parses a match job and detects active status", () => {
    const j = MatchJobSchema.parse({ id: 1, batch_id: 2, status: "running", total: 10, done: 3, error: null })
    expect(isJobActive(j)).toBe(true)
    expect(isJobActive({ status: "done" })).toBe(false)
  })

  it("rejects an unknown job status", () => {
    expect(() => MatchJobSchema.parse({ id: 1, batch_id: 2, status: "weird", total: 1, done: 0 })).toThrow()
  })

  it("parses limits and defaults the flags", () => {
    const l = ImportLimitsSchema.parse({
      max_rows_per_call: 500, isbn_batch: 50, max_file_mb: 100, upload_concurrency: 2,
      retention_days: 30, formats: ["epub"],
    })
    expect(l.ol_identified).toBe(false)
    expect(l.retention_days).toBe(30)
  })

  it("parses edition lookup with in_library default", () => {
    expect(EditionLookupSchema.parse({ olid: "OL1M" }).in_library).toBe(false)
  })
})
