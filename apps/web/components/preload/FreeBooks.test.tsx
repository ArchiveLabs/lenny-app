// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FreeBooks } from "./FreeBooks"
import { useCatalog, useCollections, useLoadBooks, useLoadProgress } from "@/hooks/preload/use-preload"

jest.mock("@/hooks/preload/use-preload")
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])),
  }),
}))

const MB = 1024 ** 2
const book = (olid: number, over = {}) => ({
  olid, title: `Book ${olid}`, authors: ["A"], year: 1900, cover_url: null, subjects: [], source: "standardebooks",
  source_id: `a/b${olid}`, size: 2 * MB, in_library: false, ...over,
})
const catalog = (books, over = {}) => ({
  isLoading: false, isError: false, isSuccess: true, hasNextPage: false, isFetchingNextPage: false,
  fetchNextPage: jest.fn(), refetch: jest.fn(),
  data: { pages: [{ books, total: books.length, available: 190, in_library: 7 }] }, ...over,
})
const mutateAsync = jest.fn()
const progress = (over = {}) => ({ jobs: [], active: 0, done: 0, failed: [], ...over })

const setup = ({ cat = catalog([book(1), book(2), book(3, { in_library: true })]), prog = progress() } = {}) => {
  useCatalog.mockReturnValue(cat)
  useCollections.mockReturnValue({ data: { collections: [{ id: "poetry", name: "Poetry", count: 12, in_library: 0 }] } })
  useLoadBooks.mockReturnValue({ mutateAsync, isPending: false })
  useLoadProgress.mockReturnValue(prog)
  render(<FreeBooks />)
}

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue({ queued: 1, already_in_library: 0, unknown: [] })
})

it("shows the available and in-library counts", () => {
  setup()
  expect(screen.getByText("190 free books available · 7 in your library")).toBeInTheDocument()
})

it("disables books already in the library and labels them", () => {
  setup()
  expect(screen.getByRole("button", { name: /Book 3/ })).toBeDisabled()
  expect(screen.getByText("In library")).toBeInTheDocument()
})

it("totals the size of the selection in the add bar", () => {
  setup()
  fireEvent.click(screen.getByRole("button", { name: /Book 1/ }))
  fireEvent.click(screen.getByRole("button", { name: /Book 2/ }))
  expect(screen.getByRole("button", { name: "Add 2 books · ~4 MB" })).toBeEnabled()
})

it("adds the selected books by edition id", async () => {
  setup()
  fireEvent.click(screen.getByRole("button", { name: /Book 1/ }))
  fireEvent.click(screen.getByRole("button", { name: /Add 1 books/ }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ olids: [1] }))
})

it("splits a selection larger than 200 into several requests", async () => {
  const many = Array.from({ length: 450 }, (_, i) => book(i + 1))
  setup({ cat: catalog(many) })
  fireEvent.click(screen.getByRole("button", { name: "Select all shown" }))
  fireEvent.click(screen.getByRole("button", { name: /Add 450 books/ }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(3))
  expect(mutateAsync.mock.calls.map((c) => c[0].olids.length)).toEqual([200, 200, 50])
})

it("keeps the selection and shows the reason when the server refuses (409)", async () => {
  mutateAsync.mockRejectedValue(new Error("A load is already running"))
  setup()
  fireEvent.click(screen.getByRole("button", { name: /Book 1/ }))
  fireEvent.click(screen.getByRole("button", { name: /Add 1 books/ }))
  expect(await screen.findByRole("alert")).toHaveTextContent("A load is already running")
  expect(screen.getByText("1 selected")).toBeInTheDocument()
})

it("parses a pasted list and reports queued, owned and unknown counts", async () => {
  mutateAsync.mockResolvedValue({ queued: 2, already_in_library: 1, unknown: ["x/y"] })
  setup()
  fireEvent.change(screen.getByLabelText("Add a list"), { target: { value: "jane-austen/emma, 123\nx/y" } })
  fireEvent.click(screen.getByRole("button", { name: "Add list" }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ olids: [123], source_ids: ["jane-austen/emma", "x/y"] }))
  expect(await screen.findByText(/2 queued, 1 already in your library, 1 not found/)).toBeInTheDocument()
  expect(screen.getByText("x/y")).toBeInTheDocument()
})

it("adds a whole collection", async () => {
  setup()
  fireEvent.click(screen.getByRole("button", { name: /Poetry/ }))
  expect(useCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ collection: "poetry" }))
  fireEvent.click(screen.getByRole("button", { name: "Add all of Poetry" }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ collection: "poetry" }))
})

it("passes the not-in-my-library toggle to the catalog", () => {
  setup()
  fireEvent.click(screen.getByLabelText("Not in my library"))
  expect(useCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ hideOwned: true }))
})

it("shows the slow first-load message while the catalog builds", () => {
  setup({ cat: catalog([], { isLoading: true, isSuccess: false, data: undefined }) })
  expect(screen.getByText(/about 30 seconds/)).toBeInTheDocument()
})

it("shows a retryable error when Open Library is unreachable", () => {
  const cat = catalog([], { isError: true, isSuccess: false, data: undefined, error: new Error("Open Library is unreachable") })
  setup({ cat })
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(cat.refetch).toHaveBeenCalled()
  expect(screen.getByRole("alert")).toHaveTextContent("Open Library is unreachable")
})

it("shows load progress, blocks new adds while running, and retries failures", async () => {
  const failed = [{ olid: 9, title: "Broken", error: "timeout", status: "failed" }]
  setup({ prog: progress({ jobs: [1], active: 2, done: 3, failed }) })
  expect(screen.getByText("Adding books: 3 done, 2 to go")).toBeInTheDocument()
  expect(screen.getByText(/Broken: timeout/)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Retry failed" })).toBeDisabled() // a load is running
})

it("retries failed books once nothing is running", async () => {
  const failed = [{ olid: 9, title: "Broken", error: "timeout", status: "failed" }]
  setup({ prog: progress({ jobs: [1], active: 0, done: 3, failed }) })
  fireEvent.click(screen.getByRole("button", { name: "Retry failed" }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ olids: [9] }))
})

it("only counts this page's load: no start time until a load is accepted, then the time it began", async () => {
  setup()
  expect(useLoadProgress).toHaveBeenLastCalledWith(null)
  const before = Date.now()
  fireEvent.click(screen.getByRole("button", { name: /Book 1/ }))
  fireEvent.click(screen.getByRole("button", { name: /Add 1 books/ }))
  await waitFor(() => expect(typeof useLoadProgress.mock.calls.at(-1)[0]).toBe("number"))
  expect(useLoadProgress.mock.calls.at(-1)[0]).toBeGreaterThanOrEqual(before)
})
