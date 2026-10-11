// @ts-nocheck
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useLoadProgress } from "./use-preload"
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
  const { result } = renderHook(() => useLoadProgress(), { wrapper })
  await waitFor(() => expect(result.current.jobs.length).toBe(4))
  expect(result.current).toMatchObject({ active: 2, done: 1 })
  expect(result.current.failed.map((j) => j.olid)).toEqual([4])
})
