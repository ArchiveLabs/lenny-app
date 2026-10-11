// @ts-nocheck
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useCatalog } from "./use-preload"
import { preloadApi } from "@/lib/preload/api"

jest.mock("@/lib/preload/api", () => ({ preloadApi: { catalog: jest.fn() } }))
jest.mock("@/lib/query-client", () => ({ forceFreshLibraryOnNextVisit: jest.fn() }))

const page = (title) => ({ books: [{ olid: 1, title, authors: [], subjects: [], source_id: "a/b", size: 0, in_library: false }], total: 1, available: 1, in_library: 0, next_cursor: null })

it("keeps the books on screen while the next search loads, then swaps them", async () => {
  let finish
  preloadApi.catalog.mockReset().mockResolvedValueOnce(page("Emma")).mockImplementationOnce(() => new Promise((ok) => (finish = () => ok(page("Persuasion")))))
  const qc = new QueryClient()
  const { result, rerender } = renderHook(({ q }) => useCatalog({ q, collection: "", hideOwned: false }), {
    initialProps: { q: "" },
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  })
  await waitFor(() => expect(result.current.data?.pages[0].books[0].title).toBe("Emma"))
  expect(result.current.isPlaceholderData).toBe(false)

  rerender({ q: "pers" })
  await waitFor(() => expect(preloadApi.catalog).toHaveBeenCalledTimes(2))
  expect(result.current.data?.pages[0].books[0].title).toBe("Emma") // not blank
  expect(result.current.isLoading).toBe(false)
  expect(result.current.isPlaceholderData).toBe(true)

  finish()
  await waitFor(() => expect(result.current.data?.pages[0].books[0].title).toBe("Persuasion"))
  expect(result.current.isPlaceholderData).toBe(false)
})

it("still shows the first load as loading", async () => {
  preloadApi.catalog.mockReset().mockImplementation(() => new Promise(() => {}))
  const { result } = renderHook(() => useCatalog({ q: "", collection: "", hideOwned: false }), {
    wrapper: ({ children }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>,
  })
  expect(result.current.isLoading).toBe(true)
  expect(result.current.data).toBeUndefined()
})

describe("usePreloadBook", () => {
  const { usePreloadBook } = require("./use-preload")
  const wrapper = ({ children }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>

  it("asks for nothing until a book is chosen", () => {
    preloadApi.book = jest.fn()
    renderHook(() => usePreloadBook(null), { wrapper })
    expect(preloadApi.book).not.toHaveBeenCalled()
  })

  it("loads the chosen book's details, and does not retry a failure on its own", async () => {
    preloadApi.book = jest.fn().mockRejectedValue(new Error("boom"))
    const { result } = renderHook(() => usePreloadBook(7), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(preloadApi.book).toHaveBeenCalledTimes(1)
    expect(preloadApi.book).toHaveBeenCalledWith(7)
  })
})

describe("useLibraryBookMetadata", () => {
  const { useLibraryBookMetadata } = require("./use-preload")
  const wrapper = ({ children }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>

  it("asks for nothing until the section is opened", () => {
    preloadApi.libraryBook = jest.fn()
    renderHook(() => useLibraryBookMetadata(null), { wrapper })
    expect(preloadApi.libraryBook).not.toHaveBeenCalled()
  })

  it("asks once for the book when opened, and does not retry a failure by itself", async () => {
    preloadApi.libraryBook = jest.fn().mockRejectedValue(new Error("boom"))
    const { result } = renderHook(() => useLibraryBookMetadata(5), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(preloadApi.libraryBook).toHaveBeenCalledTimes(1)
    expect(preloadApi.libraryBook).toHaveBeenCalledWith(5)
  })
})
