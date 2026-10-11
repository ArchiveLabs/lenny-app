// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ImportTab } from "./ImportTab"
import { useImport, useImportLimits } from "@/hooks/import/use-import"
import { useWindowDrop } from "@/hooks/import/use-window-drop"

jest.mock("@/hooks/import/use-import")
jest.mock("@/hooks/import/use-window-drop")
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])),
  }),
}))
jest.mock("./RowList", () => ({
  RowList: ({ rows, onOpen, onRemove }) => (
    <ul>{rows.map((r) => <li key={r.id}><button onClick={() => onOpen(r)}>{r.title}</button><button onClick={() => onRemove(r)}>remove {r.title}</button></li>)}</ul>
  ),
}))
jest.mock("./EditionSheet", () => ({
  ADD_ON_OPEN_LIBRARY_URL: "https://openlibrary.org/books/add",
  EditionSheet: ({ row }) => (row ? <div>editing {row.title}</div> : null),
}))

const summary = (over = {}) => ({
  id: 1, created_at: "", expires_at: "", total: 4, skipped: 0, encrypted: 0, ready: 2, auto_picked: 2,
  counts: { matched: 2, no_match: 1, needs_review: 1 }, ...over,
})
const base = (over = {}) => ({
  batchId: 1, summary: summary(), rows: [{ id: 1, title: "Dune" }], rowsLoading: false,
  loading: false, phase: { kind: "idle" }, error: null, attachedCount: 1,
  addFiles: jest.fn(), reportError: jest.fn(), recheck: jest.fn(), removeRow: jest.fn(), patchRow: jest.fn(), bulk: jest.fn(),
  runImport: jest.fn().mockResolvedValue({ missing: 0, failed: 0 }), cancelImport: jest.fn(),
  clearBatch: jest.fn(), hasFile: () => true, missing: 0, notice: null, folderName: null,
  folderSupported: false, chooseFolder: jest.fn(), reconnectFolder: jest.fn(), ...over,
})
const setup = (over?) => {
  const imp = base(over)
  useImport.mockReturnValue(imp)
  useWindowDrop.mockReturnValue(over?.dragging ?? false)
  useImportLimits.mockReturnValue({ data: { retention_days: 30 } })
  render(<QueryClientProvider client={new QueryClient()}><ImportTab /></QueryClientProvider>)
  return imp
}

it("shows a big drop zone and no list when there is no batch", () => {
  setup({ summary: undefined, batchId: null, rows: [] })
  expect(screen.getByText("Drop a folder or EPUB files here")).toBeInTheDocument()
  expect(screen.queryByText(/ready to import/)).not.toBeInTheDocument()
})

it("states the 30-day retention", () => {
  setup()
  expect(screen.getByText(/kept for 30 days/)).toBeInTheDocument()
})

it("offers Import N books and runs it", () => {
  const imp = setup()
  fireEvent.click(screen.getByRole("button", { name: "Import 2 books" }))
  expect(imp.runImport).toHaveBeenCalled()
})

it("disables import with nothing ready", () => {
  setup({ summary: summary({ ready: 0 }) })
  expect(screen.getByRole("button", { name: "Import 0 books" })).toBeDisabled()
})

it("re-checks unmatched rows and links to Open Library in a new tab", () => {
  const imp = setup()
  const link = screen.getByRole("link", { name: /Add on Open Library/ })
  expect(link).toHaveAttribute("target", "_blank")
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
  fireEvent.click(screen.getByRole("button", { name: /Re-check 1 unmatched/ }))
  expect(imp.recheck).toHaveBeenCalledWith("no_match")
})

it("hides re-check when nothing is unmatched", () => {
  setup({ summary: summary({ counts: { matched: 4 } }) })
  expect(screen.queryByRole("button", { name: /Re-check/ })).not.toBeInTheDocument()
})

it("shows a banner while matched books have no file, and nothing when all are attached", () => {
  setup({ missing: 3 })
  expect(screen.getByText(/Drop the same folder again to reconnect 3 files/)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Reconnect folder" })).not.toBeInTheDocument()
})

it("hides the banner when every matched book has its file", () => {
  setup({ missing: 0 })
  expect(screen.queryByText(/Drop the same folder again/)).not.toBeInTheDocument()
})

it("offers one-click Reconnect folder when a folder was remembered", () => {
  const imp = setup({ missing: 2, folderName: "Library" })
  fireEvent.click(screen.getByRole("button", { name: "Reconnect folder" }))
  expect(imp.reconnectFolder).toHaveBeenCalled()
})

it("reports how many files were reconnected after a drop", () => {
  setup({ notice: "Reconnected 8 of 10 files" })
  expect(screen.getByText("Reconnected 8 of 10 files")).toBeInTheDocument()
})

it("filter chips carry counts and the chosen filter reaches the hook", () => {
  setup()
  fireEvent.click(screen.getByRole("button", { name: /No match/ }))
  expect(useImport).toHaveBeenLastCalledWith({ state: "no_match" }, 0)
})

it("opens the edition panel from a row", () => {
  setup()
  fireEvent.click(screen.getByText("Dune"))
  expect(screen.getByText("editing Dune")).toBeInTheDocument()
})

it("shows a progress bar while reading files", () => {
  setup({ phase: { kind: "reading", done: 5, total: 10 } })
  expect(screen.getByRole("progressbar", { name: "Reading books" })).toHaveAttribute("aria-valuenow", "50")
})

it("shows a full-page overlay while files are dragged over the window", () => {
  setup({ dragging: true })
  expect(screen.getByText("Drop to add EPUBs")).toBeInTheDocument()
})

it("has no overlay when nothing is dragged", () => {
  setup()
  expect(screen.queryByText("Drop to add EPUBs")).not.toBeInTheDocument()
})

it("wires the window drop to addFiles and the error reporter, and pauses it while busy", () => {
  const imp = setup({ phase: { kind: "reading", done: 0, total: 1 } })
  expect(useWindowDrop).toHaveBeenLastCalledWith(imp.addFiles, imp.reportError, false)
})

it("shows a message when the folder picker returns nothing usable", () => {
  const imp = setup()
  const input = screen.getByTestId("folder-input")
  fireEvent.change(input, { target: { files: [] } })
  expect(imp.reportError).toHaveBeenCalledWith(expect.stringMatching(/No files found/))
})

describe("match status", () => {
  const match = (over = {}) => ({ id: "j", status: "running", total: 30, done: 12, error: null, retry_after: null, ...over })
  const queued = (m) => summary({ counts: { queued: 20, matched: 10 }, total: 30, match: m })

  it("shows Matched done of total while the job runs", () => {
    setup({ summary: queued(match()) })
    expect(screen.getByText("Matched 12 of 30")).toBeInTheDocument()
  })

  it("shows the error, the wait and a Retry button when the job failed", () => {
    const imp = setup({ summary: queued(match({ status: "failed", error: "Open Library is rate limiting us", retry_after: 42.2 })) })
    expect(screen.getByRole("alert")).toHaveTextContent("Open Library is rate limiting us")
    expect(screen.getByRole("alert")).toHaveTextContent("Try again in about 43 seconds.")
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry matching" }))
    expect(imp.recheck).toHaveBeenCalledWith("queued")
  })

  it("omits the wait when retry_after is not set", () => {
    setup({ summary: queued(match({ status: "failed", error: "boom" })) })
    expect(screen.getByRole("alert")).not.toHaveTextContent("Try again")
  })
})

it("passes a row's Remove to the hook", () => {
  const imp = setup()
  fireEvent.click(screen.getByRole("button", { name: "remove Dune" }))
  expect(imp.removeRow).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
})

describe("reconnect banner", () => {
  it("is hidden while files are held in memory", () => {
    setup({ missing: 0 })
    expect(screen.queryByText(/Drop the same folder again/)).not.toBeInTheDocument()
  })

  it("is hidden during a silent reconnect", () => {
    setup({ missing: 2, folderName: "Library", reconnecting: true })
    expect(screen.queryByText(/Drop the same folder again/)).not.toBeInTheDocument()
  })

  it("offers the button and the Chrome hint when the browser needs a click", () => {
    const imp = setup({ missing: 2, folderName: "Library", folderSupported: true })
    expect(screen.getByText(/Allow on every visit/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Reconnect folder" }))
    expect(imp.reconnectFolder).toHaveBeenCalled()
  })

  it("asks to drop again, with no button or hint, when there is no remembered folder", () => {
    setup({ missing: 2 })
    expect(screen.getByText(/Drop the same folder again to reconnect 2 files/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reconnect folder" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Allow on every visit/)).not.toBeInTheDocument()
  })
})

it("renders nothing, not a placeholder block, while the saved list loads", () => {
  setup({ loading: true, summary: undefined })
  expect(screen.queryByText("Drop a folder or EPUB files here")).not.toBeInTheDocument()
  expect(document.querySelector('[class*="animate-pulse"]')).toBeNull()
})

describe("server-side upload", () => {
  it("explains that files upload as books are matched", () => {
    setup()
    expect(screen.getByText("Files are uploaded as books are matched, so you can leave this page.")).toBeInTheDocument()
  })

  it("shows N of M uploaded while sending files", () => {
    setup({ uploading: true, summary: summary({ staged: 3, unstaged: 1 }) })
    expect(screen.getByText("Uploading files")).toBeInTheDocument()
    expect(screen.getByText("3 / 4")).toBeInTheDocument()
  })

  it("reports failed uploads with a retry", () => {
    const imp = setup({ uploadFailed: 2, retryUploads: jest.fn() })
    expect(screen.getByRole("alert")).toHaveTextContent("2 files could not be uploaded.")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(imp.retryUploads).toHaveBeenCalled()
  })
})

it("keeps the big drop zone and hides the list for an empty batch", () => {
  setup({ summary: summary({ total: 0, ready: 0, counts: {} }), rows: [] })
  expect(screen.getByText("Drop a folder or EPUB files here")).toBeInTheDocument()
  expect(screen.queryByText(/kept for 30 days/)).not.toBeInTheDocument()
  expect(screen.queryByRole("group", { name: "Filter books" })).not.toBeInTheDocument()
  expect(screen.queryByText(/Files are uploaded as books are matched/)).not.toBeInTheDocument()
})

describe("no Skip", () => {
  it("has no Skipped filter and no skip items in the bulk menu", async () => {
    setup({ summary: summary({ skipped: 0 }) })
    expect(screen.queryByRole("button", { name: /^Skipped/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/skip/i)).not.toBeInTheDocument()
  })

  it("shows bulk actions above the list with their scope, not in a hidden menu", () => {
    setup()
    expect(screen.queryByRole("button", { name: "Actions for these books" })).not.toBeInTheDocument()
    expect(screen.getByText("Applies to 4 books in this view")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove all" })).toBeInTheDocument()
  })

  it("confirms with the count before removing the current filter", async () => {
    const imp = setup()
    fireEvent.click(screen.getByRole("button", { name: "Remove all" }))
    expect(await screen.findByText("Remove 4 books from this list?")).toBeInTheDocument()
    expect(imp.bulk).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(imp.bulk).toHaveBeenCalledWith("remove")
  })

  it("encrypts everything in view, then turns it off again once all are encrypted", () => {
    const imp = setup({ rows: [{ id: 1, title: "A", encrypted: false }, { id: 2, title: "B", encrypted: true }] })
    fireEvent.click(screen.getByRole("checkbox", { name: "Encrypt all" }))
    expect(imp.bulk).toHaveBeenCalledWith("set_encrypted", true)
  })

  it("unchecks Encrypt all when every book is already encrypted", () => {
    const imp = setup({ rows: [{ id: 1, title: "A", encrypted: true }, { id: 2, title: "B", encrypted: true }] })
    fireEvent.click(screen.getByRole("checkbox", { name: "Encrypt all" }))
    expect(imp.bulk).toHaveBeenCalledWith("set_encrypted", false)
  })

  it("hides the bulk strip when there are no books to act on", () => {
    setup({ rows: [] })
    expect(screen.queryByRole("button", { name: "Remove all" })).not.toBeInTheDocument()
  })

  it("offers a one-time clean-up for books skipped earlier", () => {
    const imp = setup({ summary: summary({ skipped: 3 }) })
    expect(screen.getByText("3 books were skipped earlier")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove them" }))
    expect(imp.bulk).toHaveBeenCalledWith("remove", undefined, { skipped: true })
  })
})

describe("numbered pages", () => {
  it("shows the pager with the server's total for this view", () => {
    setup({ total: 120 })
    expect(screen.getByText("Showing 1–50 of 120")).toBeInTheDocument()
  })

  it("falls back to the chip count when the server sends no total and there is no search", () => {
    setup({ total: undefined, summary: summary({ total: 120, counts: { matched: 120 } }) })
    expect(screen.getByText("Showing 1–50 of 120")).toBeInTheDocument()
  })

  it("asks the hook for the page that was clicked", () => {
    setup({ total: 120 })
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }))
    expect(useImport).toHaveBeenLastCalledWith(expect.anything(), 2)
  })

  it("goes back to page 1 when the filter changes", () => {
    setup({ total: 120 })
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }))
    fireEvent.click(screen.getByRole("button", { name: /^Matched/ }))
    expect(useImport).toHaveBeenLastCalledWith(expect.objectContaining({ state: "matched" }), 0)
  })

  it("goes back to page 1 when searching", () => {
    setup({ total: 120 })
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }))
    fireEvent.change(screen.getByLabelText("Search title or file"), { target: { value: "dune" } })
    expect(useImport).toHaveBeenLastCalledWith(expect.objectContaining({ q: "dune" }), 0)
  })

  it("steps back when removals leave the page past the end", () => {
    useImport.mockReturnValue(base({ total: 120 }))
    useWindowDrop.mockReturnValue(false)
    useImportLimits.mockReturnValue({ data: { retention_days: 30 } })
    const client = new QueryClient()
    const tree = () => <QueryClientProvider client={client}><ImportTab /></QueryClientProvider> // a fresh element, so it re-renders
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }))
    expect(useImport).toHaveBeenLastCalledWith(expect.anything(), 2)
    useImport.mockReturnValue(base({ total: 60 })) // removed down to 2 pages
    view.rerender(tree())
    expect(useImport).toHaveBeenLastCalledWith(expect.anything(), 1)
  })
})
