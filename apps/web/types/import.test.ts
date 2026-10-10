// @ts-nocheck
import { ImportBatchSummarySchema, ImportRowPageSchema, isReady, needsAction } from "./import"

const row = { id: "a1", path: "books/x.epub", size: 10, mtime: 1, state: "matched", decision: "auto" }

describe("import contract schemas", () => {
  it("parses a row page and fills defaults", () => {
    const page = ImportRowPageSchema.parse({ rows: [row], next_cursor: null })
    expect(page.rows[0]).toMatchObject({ auto_picked: false, candidates_count: 0, encrypted: false })
  })

  it("rejects an unknown state", () => {
    expect(() => ImportRowPageSchema.parse({ rows: [{ ...row, state: "weird" }], next_cursor: null })).toThrow()
  })

  it("parses a batch summary", () => {
    const s = ImportBatchSummarySchema.parse({ id: "b", created_at: "t", expires_at: "t", total: 2, counts: { matched: 2 } })
    expect(s.skipped).toBe(0)
  })

  it("ready = matched and not skipped; needs action = needs_review or no_match", () => {
    expect(isReady({ state: "matched", decision: "auto" })).toBe(true)
    expect(isReady({ state: "matched", decision: "skip" })).toBe(false)
    expect(isReady({ state: "needs_review", decision: "auto" })).toBe(false)
    expect(needsAction({ state: "no_match" })).toBe(true)
    expect(needsAction({ state: "matched" })).toBe(false)
  })
})
