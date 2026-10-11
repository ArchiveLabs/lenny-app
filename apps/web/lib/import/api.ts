import { z } from "zod"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import {
  DuplicateCheckSchema, ImportBatchListSchema, ImportBatchSummarySchema,
  ImportCandidatesSchema, ImportLimitsSchema, ImportJobSchema, ImportRowPageSchema, ImportRowSchema, MatchJobSchema,
  type ImportRowState,
} from "@/types/import"

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
})
const base = (id: number) => `import/batches/${id}`

export interface RowFilter {
  state?: ImportRowState
  q?: string
  skipped?: boolean
  staged?: boolean
  /** Leave out rows in this state, e.g. the books already imported. */
  exclude_state?: ImportRowState
  order?: "imported_at_desc"
  auto_picked?: boolean
}

export interface NewRow {
  path: string
  size: number
  mtime: number
  isbn?: string
  title?: string
  author?: string
  language?: string
  publisher?: string
  year?: number
  state?: "not_epub"
}

const query = (o: Record<string, string | number | boolean | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ""
}

export const importApi = {
  limits: () => fetchAdmin("import/limits").then((r) => handleApiResponse(r, ImportLimitsSchema)),
  listBatches: () => fetchAdmin("import/batches").then((r) => handleApiResponse(r, ImportBatchListSchema)),
  createBatch: () => fetchAdmin("import/batches", json("POST")).then((r) => handleApiResponse(r, ImportBatchSummarySchema)),
  batch: (id: number) => fetchAdmin(base(id)).then((r) => handleApiResponse(r, ImportBatchSummarySchema)),
  deleteBatch: (id: number) => fetchAdmin(base(id), { method: "DELETE" }).then((r) => handleApiResponse(r)),
  putRows: (id: number, rows: NewRow[]) =>
    fetchAdmin(`${base(id)}/rows`, json("PUT", { rows })).then((r) =>
      handleApiResponse(r, z.object({ created: z.number(), existing: z.number(), existing_states: z.record(z.string(), z.number()).default({}) })),
    ),
  rows: (id: number, f: RowFilter & { cursor?: string; limit?: number; offset?: number }) =>
    fetchAdmin(`${base(id)}/rows${query({ ...f, limit: f.limit ?? 100 })}`).then((r) =>
      handleApiResponse(r, ImportRowPageSchema),
    ),
  patchRow: (id: number, rowId: number, body: { olid?: number; encrypted?: boolean }) =>
    fetchAdmin(`${base(id)}/rows/${rowId}`, json("PATCH", body)).then((r) => handleApiResponse(r, ImportRowSchema)),
  removeRow: (id: number, rowId: number) => fetchAdmin(`${base(id)}/rows/${rowId}`, { method: "DELETE" }).then((r) => handleApiResponse(r, ImportBatchSummarySchema)),
  action: (id: number, body: { action: "set_encrypted" | "remove"; value?: boolean; row_ids?: number[] } & RowFilter) =>
    fetchAdmin(`${base(id)}/actions`, json("POST", body)).then((r) =>
      handleApiResponse(r, z.object({ updated: z.number() })),
    ),
  startMatch: (id: number, body: { state?: "queued" | "no_match" | "needs_review"; row_ids?: number[] } = {}) =>
    fetchAdmin(`${base(id)}/match`, json("POST", body)).then((r) => handleApiResponse(r, MatchJobSchema)),
  job: (jobId: string) => fetchAdmin(`import/match/${jobId}`).then((r) => handleApiResponse(r, MatchJobSchema)),
  candidates: (id: number, rowId: number) =>
    fetchAdmin(`${base(id)}/rows/${rowId}/candidates`).then((r) => handleApiResponse(r, ImportCandidatesSchema)),
  /** Live search scored against the row: words, an ISBN, an edition key or an openlibrary.org link. q is 2+ characters. */
  searchEditions: (id: number, rowId: number, q: string) =>
    fetchAdmin(`${base(id)}/rows/${rowId}/search${query({ q })}`).then((r) => handleApiResponse(r, ImportCandidatesSchema)),
  checkDuplicates: (olids: number[]) =>
    fetchAdmin("import/check-duplicates", json("POST", { olids })).then((r) =>
      handleApiResponse(r, DuplicateCheckSchema),
    ),
  /** Stores the EPUB on the server so the import needs no browser later. Idempotent. */
  stageFile: (id: number, rowId: number, file: Blob) => {
    const form = new FormData()
    form.append("file", file)
    return fetchAdmin(`${base(id)}/rows/${rowId}/staged`, { method: "PUT", body: form }).then((r) =>
      handleApiResponse(r, ImportRowSchema),
    )
  },
  /** Starts the server-side import of every ready row whose file is staged. It keeps running if the page closes. */
  startImport: (id: number, body: { retry_failed?: boolean } = {}) =>
    fetchAdmin(`${base(id)}/import`, json("POST", body)).then((r) => handleApiResponse(r, ImportJobSchema)),
}
