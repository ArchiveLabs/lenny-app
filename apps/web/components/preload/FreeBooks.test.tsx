// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FreeBooks } from "./FreeBooks"
import { ApiError } from "@/types/api"
import { useCatalog, useCatalogRefresh, useCollections, useLoadBooks, useLoadProgress } from "@/hooks/preload/use-preload"
import { toast } from "sonner"

jest.mock("@/hooks/preload/use-preload")
jest.mock("sonner", () => ({ toast: { info: jest.fn() } }))
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
const refresh = jest.fn()
const progress = (over = {}) => ({ jobs: [], active: 0, done: 0, failed: [], ...over })

const setup = ({ cat = catalog([book(1), book(2), book(3, { in_library: true })]), prog = progress(), refreshState = {} } = {}) => {
  useCatalog.mockReturnValue(cat)
  useCatalogRefresh.mockReturnValue({ checking: false, error: null, refresh, ...refreshState })
  useCollections.mockReturnValue({ data: { collections: [{ id: "poetry", name: "Poetry", count: 12, in_library: 0 }] } })
  useLoadBooks.mockReturnValue({ mutateAsync, isPending: false })
  useLoadProgress.mockReturnValue(prog)
  render(<FreeBooks />)
}

beforeEach(() => {
  refresh.mockReset()
  toast.info.mockReset()
  sessionStorage.clear()
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
  fireEvent.change(screen.getByLabelText("Show"), { target: { value: "poetry" } })
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

describe("the page's chrome", () => {
  const failedCatalog = (error) => catalog([], { isError: true, isSuccess: false, data: undefined, error })

  it("does not repeat the page heading when the catalog has not loaded", () => {
    setup({ cat: failedCatalog(new ApiError("Not Found", 404)) })
    expect(screen.queryByText("Free books")).not.toBeInTheDocument()
  })

  it("says no books are added yet on a 404, instead of a bare error", () => {
    setup({ cat: failedCatalog(new ApiError("Not Found", 404)) })
    expect(screen.getByText("No books added yet")).toBeInTheDocument()
    expect(screen.queryByText(/not available on this server/)).not.toBeInTheDocument()
    expect(screen.queryByText("Not Found")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("offers to preload by browsing the catalog, which asks for it again", () => {
    const cat = failedCatalog(new ApiError("Not Found", 404))
    setup({ cat })
    fireEvent.click(screen.getByRole("button", { name: "Preload books" }))
    expect(cat.refetch).toHaveBeenCalled()
  })

  it("offers to preload by pasting a list, which opens the list box and focuses it", async () => {
    setup({ cat: failedCatalog(new ApiError("Not Found", 404)) })
    const box = screen.getByLabelText("Add a list")
    expect(box.closest("details")).not.toHaveAttribute("open")
    fireEvent.click(screen.getByRole("button", { name: "Paste a list" }))
    await waitFor(() => expect(box.closest("details")).toHaveAttribute("open"))
    await waitFor(() => expect(box).toHaveFocus())
  })

  it("does not show the empty state for other failures", () => {
    setup({ cat: failedCatalog(new ApiError("boom", 500)) })
    expect(screen.queryByText("No books added yet")).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Try again.")
  })

  it("says Open Library did not answer only for a 502", () => {
    setup({ cat: failedCatalog(new ApiError("bad gateway", 502)) })
    expect(screen.getByRole("alert")).toHaveTextContent("Open Library did not answer. Try again in a moment.")
  })

  it("hides search, filters and collections when the catalog could not load", () => {
    setup({ cat: failedCatalog(new ApiError("boom", 500)) })
    expect(screen.queryByLabelText("Search title, author or subject")).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Collections" })).not.toBeInTheDocument()
  })

  it("has no lone All chip when there are no collections", () => {
    useCatalog.mockReturnValue(catalog([book(1)]))
    useCollections.mockReturnValue({ data: { collections: [] } })
    useLoadBooks.mockReturnValue({ mutateAsync, isPending: false })
    useLoadProgress.mockReturnValue(progress())
    useCatalogRefresh.mockReturnValue({ checking: false, error: null, refresh })
    render(<FreeBooks />)
    expect(screen.queryByRole("group", { name: "Collections" })).not.toBeInTheDocument()
  })

  it("shows no add bar until something is picked", () => {
    setup()
    expect(screen.queryByText("Pick books to add")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Add books$/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Book 1/ }))
    expect(screen.getByText("1 selected")).toBeInTheDocument()
  })

  it("tucks the list box away until it is wanted", () => {
    setup()
    const box = screen.getByLabelText("Add a list")
    expect(box.closest("details")).not.toHaveAttribute("open")
    expect(screen.getByText("Add a list of books")).toBeInTheDocument()
  })

  it("shows a refusal such as a running load as a warning, with the server's words", async () => {
    mutateAsync.mockRejectedValue(new ApiError("A load is already running", 409))
    setup()
    fireEvent.click(screen.getByRole("button", { name: /Book 1/ }))
    fireEvent.click(screen.getByRole("button", { name: /Add 1 books/ }))
    expect(await screen.findByRole("status")).toHaveTextContent("A load is already running")
  })

  it("shows progress as a bar while books are being added", () => {
    setup({ prog: progress({ jobs: [1], active: 2, done: 3 }) })
    expect(screen.getByRole("progressbar", { name: "Adding books: 3 done, 2 to go" })).toHaveAttribute("aria-valuenow", "60")
  })

  it("says how many were added once the load is done", () => {
    setup({ prog: progress({ jobs: [1], active: 0, done: 5 }) })
    expect(screen.getByText("5 books added")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })
})

describe("what is new", () => {
  const withMeta = (books, meta = {}) =>
    catalog(books, { data: { pages: [{ books, total: books.length, available: 190, in_library: 7, new: 0, updated_at: null, refreshing: false, ...meta }] } })

  it("marks only the new books", () => {
    setup({ cat: withMeta([book(1, { is_new: true }), book(2)], { new: 1 }) })
    expect(screen.getAllByText("New")).toHaveLength(1)
    expect(screen.getByRole("button", { name: /Book 1/ })).toHaveTextContent("New")
    expect(screen.getByRole("button", { name: /Book 2/ })).not.toHaveTextContent("New")
  })

  it("offers a New (N) choice in the Show menu only when something is new", () => {
    setup({ cat: withMeta([book(1)], { new: 0 }) })
    expect(screen.queryByRole("option", { name: /^New \(/ })).not.toBeInTheDocument()
  })

  it("filters to new books and asks the catalog for new_only", () => {
    setup({ cat: withMeta([book(1, { is_new: true })], { new: 3 }) })
    expect(screen.getByRole("option", { name: "New (3)" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "__new" } })
    expect(useCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ newOnly: true, collection: "" }))
    expect(screen.getByLabelText("Show")).toHaveValue("__new")
  })

  it("lets a collection or All books replace the New filter", () => {
    setup({ cat: withMeta([book(1)], { new: 3 }) })
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "__new" } })
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "poetry" } })
    expect(useCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ newOnly: false, collection: "poetry" }))
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "__new" } })
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "" } })
    expect(useCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ newOnly: false, collection: "" }))
  })

  it("says nothing is new when the new filter has no books", () => {
    setup({ cat: withMeta([], { new: 2 }) })
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "__new" } })
    expect(screen.getByText("Nothing new in the last 14 days")).toBeInTheDocument()
    expect(screen.queryByText("No books match.")).not.toBeInTheDocument()
  })
})

describe("sorting", () => {
  it("is A-Z by default, and asks for newest first when chosen", () => {
    setup()
    expect(useCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "title" }))
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "added_desc" } })
    expect(useCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "added_desc" }))
  })

  it("remembers the choice for the session", () => {
    setup()
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "added_desc" } })
    expect(sessionStorage.getItem("lenny-free-books-sort")).toBe("added_desc")
  })

  it("starts from the remembered choice", () => {
    sessionStorage.setItem("lenny-free-books-sort", "added_desc")
    setup()
    expect(useCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "added_desc" }))
    expect(screen.getByLabelText("Sort")).toHaveValue("added_desc")
  })

  it("still works when the browser blocks storage", () => {
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    setup()
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "added_desc" } })
    expect(useCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "added_desc" }))
    get.mockRestore()
    set.mockRestore()
  })
})

describe("updating from archive.org", () => {
  const meta = (over = {}) => ({ data: { pages: [{ books: [book(1)], total: 1, available: 190, in_library: 7, new: 0, updated_at: new Date(Date.now() - 5 * 60_000).toISOString(), refreshing: false, ...over }] } })

  it("shows when the list was last updated", () => {
    setup({ cat: catalog([book(1)], meta()) })
    expect(screen.getByText("Updated 5 minutes ago")).toBeInTheDocument()
  })

  it("shows no time when the server does not know it", () => {
    setup({ cat: catalog([book(1)], meta({ updated_at: null })) })
    expect(screen.queryByText(/^Updated/)).not.toBeInTheDocument()
  })

  it("checks archive.org from the refresh button", () => {
    setup({ cat: catalog([book(1)], meta()) })
    fireEvent.click(screen.getByRole("button", { name: "Check for new books" }))
    expect(refresh).toHaveBeenCalled()
  })

  it("shows a spinner and Checking archive.org… while it checks, with the button disabled", () => {
    setup({ cat: catalog([book(1)], meta()), refreshState: { checking: true } })
    expect(screen.getByText("Checking archive.org…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Check for new books" })).toBeDisabled()
    expect(screen.queryByText(/^Updated/)).not.toBeInTheDocument()
  })

  it("shows the same while the server is rebuilding on its own", () => {
    setup({ cat: catalog([book(1)], meta({ refreshing: true })) })
    expect(screen.getByText("Checking archive.org…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Check for new books" })).toBeDisabled()
  })

  it("says so when the check fails, with a retry", () => {
    setup({ cat: catalog([book(1)], meta()), refreshState: { error: new ApiError("bad gateway", 502) } })
    expect(screen.getByRole("alert")).toHaveTextContent("archive.org did not answer. Try again in a moment.")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(refresh).toHaveBeenCalled()
  })
})

describe("telling the admin the list grew", () => {
  const withAvailable = (n) => catalog([book(1)], { data: { pages: [{ books: [book(1)], total: 1, available: n, in_library: 0, new: 0, updated_at: null, refreshing: false }] } })
  const mount = (n) => {
    useCatalog.mockReturnValue(withAvailable(n))
    useCatalogRefresh.mockReturnValue({ checking: false, error: null, refresh })
    useCollections.mockReturnValue({ data: { collections: [] } })
    useLoadBooks.mockReturnValue({ mutateAsync, isPending: false })
    useLoadProgress.mockReturnValue(progress())
    return render(<FreeBooks />)
  }
  const reload = (view, n) => {
    useCatalog.mockReturnValue(withAvailable(n))
    view.rerender(<FreeBooks />)
  }

  it("does not toast on the first load", () => {
    mount(190)
    expect(toast.info).not.toHaveBeenCalled()
  })

  it("toasts the increase, once per increase", () => {
    const view = mount(190)
    reload(view, 193)
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(toast.info).toHaveBeenCalledWith("3 new books are available")
    reload(view, 193) // the same list again
    expect(toast.info).toHaveBeenCalledTimes(1)
    reload(view, 194)
    expect(toast.info).toHaveBeenLastCalledWith("1 new books are available")
  })

  it("does not toast when the list shrinks", () => {
    const view = mount(190)
    reload(view, 180)
    expect(toast.info).not.toHaveBeenCalled()
  })
})

describe("the toolbar", () => {
  it("is one row: search, Show, Sort and Not in my library", () => {
    setup()
    for (const name of ["Search title, author or subject", "Show", "Sort", "Not in my library"]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
  })

  it("shows the collections with their counts in the Show menu, not as rows of chips", () => {
    setup()
    expect(screen.getByRole("option", { name: "Poetry (12)" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "All books" })).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Collections" })).not.toBeInTheDocument()
  })

  it("has no Show menu when there is nothing to choose between", () => {
    useCatalog.mockReturnValue(catalog([book(1)]))
    useCollections.mockReturnValue({ data: { collections: [] } })
    useLoadBooks.mockReturnValue({ mutateAsync, isPending: false })
    useLoadProgress.mockReturnValue(progress())
    useCatalogRefresh.mockReturnValue({ checking: false, error: null, refresh })
    render(<FreeBooks />)
    expect(screen.queryByLabelText("Show")).not.toBeInTheDocument()
  })

  it("puts the list's actions in a slim header above the books", () => {
    setup()
    expect(screen.getByText("3 books shown")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Select all shown" })).toBeInTheDocument()
  })

  it("adds Add all of the collection to that header once one is chosen", () => {
    setup()
    expect(screen.queryByRole("button", { name: /Add all of/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "poetry" } })
    expect(screen.getByRole("button", { name: "Add all of Poetry" })).toBeInTheDocument()
  })
})
