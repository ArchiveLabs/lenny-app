// @ts-nocheck
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { inCurrentLoad, useLoadProgress } from "./use-preload"
import { fetchAdmin } from "@/lib/api-client"

jest.mock("@/lib/api-client", () => ({ ...jest.requireActual("@/lib/api-client"), fetchAdmin: jest.fn() }))
jest.mock("@/lib/query-client", () => ({ forceFreshLibraryOnNextVisit: jest.fn() }))

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)

it("counts only Standard Ebooks loads, split by status", async () => {
  const job = (source, olid, status) => ({ source, olid, status, title: "t" })
  fetchAdmin.mockResolvedValue(
    {
      ok: true,
      status: 200,
      json: async () => ({
        imports: [
          job("standardebooks", 1, "done"), job("standardebooks", 2, "downloading"),
          job("standardebooks", 3, "pending"), job("standardebooks", 4, "failed"), job("briet", 5, "downloading"),
        ],
      }),
    },
  )
  const { result } = renderHook(() => useLoadProgress(null), { wrapper })
  // no load started on this page: only running jobs count (a reload mid-load)
  await waitFor(() => expect(result.current.jobs.length).toBe(2))
  expect(result.current).toMatchObject({ active: 2, done: 0 })
})

it("with a start time, counts finished jobs updated since then, by status", async () => {
  const since = Date.parse("2026-10-11T10:00:00Z")
  const job = (olid, status, updated_at) => ({ source: "standardebooks", olid, status, updated_at, title: "t" })
  fetchAdmin.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      imports: [
        job(1, "done", "2026-10-11T10:00:30Z"), job(2, "failed", "2026-10-11T10:01:00"), // no zone = UTC
        job(3, "done", "2026-10-05T10:00:00Z"), // last week's load
        job(4, "downloading", "2026-10-05T10:00:00Z"), // still running: always current
      ],
    }),
  })
  const { result } = renderHook(() => useLoadProgress(since), { wrapper })
  await waitFor(() => expect(result.current.jobs.length).toBe(3))
  expect(result.current).toMatchObject({ active: 1, done: 1 })
  expect(result.current.failed.map((j) => j.olid)).toEqual([2])
})

describe("inCurrentLoad", () => {
  const since = Date.parse("2026-10-11T10:00:00Z")
  const done = (updated_at) => ({ source: "standardebooks", olid: 1, status: "done", updated_at })
  it("tolerates a few seconds of clock skew but not more", () => {
    expect(inCurrentLoad(done("2026-10-11T09:59:57Z"), since)).toBe(true)
    expect(inCurrentLoad(done("2026-10-11T09:59:50Z"), since)).toBe(false)
  })
  it("excludes finished jobs with no timestamp or no start time", () => {
    expect(inCurrentLoad({ ...done(null) }, since)).toBe(false)
    expect(inCurrentLoad(done("2026-10-11T10:05:00Z"), null)).toBe(false)
  })
})
