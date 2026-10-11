// @ts-nocheck
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useLibraryLinks } from "./use-library-links"
import { fetchLibraryLinks } from "@/lib/library/links"

jest.mock("@/lib/library/links", () => ({ fetchLibraryLinks: jest.fn() }))

const mount = (qc) => renderHook(() => useLibraryLinks(), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> })

beforeEach(() => fetchLibraryLinks.mockReset())

it("fetches once and shares the answer between every user of it", async () => {
  fetchLibraryLinks.mockResolvedValue({ opds_feed: "f" })
  const qc = new QueryClient()
  const a = mount(qc)
  const b = mount(qc)
  await waitFor(() => expect(a.result.current.data).toEqual({ opds_feed: "f" }))
  await waitFor(() => expect(b.result.current.data).toEqual({ opds_feed: "f" }))
  expect(fetchLibraryLinks).toHaveBeenCalledTimes(1)
})

it("does not retry a failure, and leaves the data empty", async () => {
  fetchLibraryLinks.mockRejectedValue(new Error("404"))
  const { result } = mount(new QueryClient())
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(fetchLibraryLinks).toHaveBeenCalledTimes(1)
  expect(result.current.data).toBeUndefined()
})
