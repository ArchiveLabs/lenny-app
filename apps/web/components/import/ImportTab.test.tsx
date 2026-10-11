// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
  RowList: ({ rows, onOpen, onDetails, onRemove, onSelect, selected }) => (
    <ul>{rows.map((r) => <li key={r.id}><button onClick={() => onOpen(r)}>{r.title}</button><button onClick={() => onRemove(r)}>remove {r.title}</button><button onClick={() => onDetails(r)}>details {r.title}</button><input type="checkbox" aria-label={`pick ${r.title}`} checked={selected.has(r.id)} onChange={(e) => onSelect(r, e.target.checked)} /></li>)}</ul>
  ),
}))
jest.mock("./ImportHistory", () => ({ ImportHistory: ({ total }) => <div>history of {total}</div> }))
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
  addFiles: jest.fn(), reportError: jest.fn(), recheck: jest.fn(), removeRow: jest.fn(), removeRows: jest.fn(), encryptRows: jest.fn(), failedUploads: new Set(), patchRow: jest.fn(), bulk: jest.fn(),
  runImport: jest.fn().mockResolvedValue({ missing: 0, failed: 0 }), cancelImport: jest.fn(),
  clearBatch: jest.fn(), clearLoaded: jest.fn(), hasFile: () => true, missing: 0, notice: null, folderName: null,
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
  expect(screen.getByText(/Kept for 30 days/)).toBeInTheDocument()
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
  it("explains that files upload as books are matched, only while they are uploading", () => {
    setup({ uploading: true, summary: summary({ staged: 1, unstaged: 1 }) })
    expect(screen.getByText("Files are uploaded as books are matched, so you can leave this page.")).toBeInTheDocument()
  })

  it("leaves that sentence out when nothing is uploading", () => {
    setup()
    expect(screen.queryByText(/Files are uploaded as books are matched/)).not.toBeInTheDocument()
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

describe("book details panel", () => {
  const rows = [{ id: 1, title: "Dune", path: "L/dune.epub", size: 2048, mtime: 1, state: "matched", olid: 5, auto_picked: true, confidence: 90, candidates_count: 0, encrypted: false, staged: true }]

  it("opens from a row's arrow and follows the row", () => {
    setup({ rows })
    fireEvent.click(screen.getByRole("button", { name: "details Dune" }))
    expect(screen.getByText("Compare")).toBeInTheDocument()
    expect(screen.getByText("L/dune.epub")).toBeInTheDocument()
  })

  it("hands over to the edition panel from Change edition", () => {
    setup({ rows })
    fireEvent.click(screen.getByRole("button", { name: "details Dune" }))
    fireEvent.click(screen.getByRole("button", { name: "Change edition" }))
    expect(screen.getByText("editing Dune")).toBeInTheDocument()
    expect(screen.queryByText("L/dune.epub")).not.toBeInTheDocument()
  })
})

describe("server-side import", () => {
  const job = (over = {}) => ({ id: "j", status: "done", total: 10, done: 10, imported: 7, duplicate: 1, failed: 2, waiting: 0, error: null, ...over })

  it("disables Import and says Importing… while the server runs it", () => {
    setup({ importing: true })
    const button = screen.getByRole("button", { name: /Importing…/ })
    expect(button).toBeDisabled()
    expect(screen.queryByRole("button", { name: /Stop after/ })).not.toBeInTheDocument()
  })

  it("shows the running status panel from the summary, as after a reload", () => {
    setup({ importing: true, summary: summary({ counts: { matched: 1, imported: 4 }, import: job({ status: "running", done: 4, total: 10 }) }) })
    expect(screen.getByText("Importing 4 of 10")).toBeInTheDocument()
    expect(screen.getByText("You can leave this page. The import continues on the server.")).toBeInTheDocument()
  })

  it("shows the result when done, and Show failed switches to the Failed filter", () => {
    setup({ summary: summary({ counts: { imported: 7, failed: 2 }, import: job() }) })
    expect(screen.getByText("7 imported. 1 were already in your library. 2 failed.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Show failed" }))
    expect(useImport).toHaveBeenLastCalledWith({ state: "failed" }, 0)
  })

  it("retries failed rows through the hook", () => {
    const imp = setup({ summary: summary({ counts: { imported: 7, failed: 2 }, import: job() }) })
    fireEvent.click(screen.getByRole("button", { name: "Retry failed" }))
    expect(imp.runImport).toHaveBeenCalledWith(true)
  })

  it("starts again after a failed job", () => {
    const imp = setup({ summary: summary({ import: job({ status: "failed", error: "boom" }) }) })
    fireEvent.click(screen.getByRole("button", { name: "Start again" }))
    expect(imp.runImport).toHaveBeenCalledWith()
  })

  it("starts the import once, with no arguments, from the Import button", () => {
    const imp = setup()
    fireEvent.click(screen.getByRole("button", { name: "Import 2 books" }))
    expect(imp.runImport).toHaveBeenCalledTimes(1)
    expect(imp.runImport).toHaveBeenCalledWith()
  })
})

describe("Loaded and History tabs", () => {
  const withImported = (over = {}) => ({ summary: summary({ total: 4, counts: { matched: 1, imported: 3 }, ...over }) })

  it("counts loaded books and imported books separately", () => {
    setup(withImported())
    expect(screen.getByRole("tab", { name: /Loaded/ })).toHaveTextContent("1")
    expect(screen.getByRole("tab", { name: /History/ })).toHaveTextContent("3")
  })

  it("lists only loaded books under All: imported ones are left out", () => {
    setup(withImported())
    expect(useImport).toHaveBeenLastCalledWith({ exclude_state: "imported" }, 0)
    expect(screen.queryByRole("button", { name: /^Imported/ })).not.toBeInTheDocument()
  })

  it("shows the loaded list first, and the history when its tab is chosen", async () => {
    setup(withImported())
    expect(screen.getByText("Dune")).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole("tab", { name: /History/ }))
    expect(await screen.findByText("history of 3")).toBeInTheDocument()
    expect(screen.queryByText("Dune")).not.toBeInTheDocument()
  })

  it("opens the history from the result panel", async () => {
    setup(withImported({ import: { id: "j", status: "done", total: 3, done: 3, imported: 3, duplicate: 0, failed: 0, waiting: 0 } }))
    fireEvent.click(screen.getByRole("button", { name: "View history" }))
    expect(await screen.findByText("history of 3")).toBeInTheDocument()
  })

  it("keeps History when starting over: only the loaded books are cleared", async () => {
    const imp = setup(withImported())
    fireEvent.click(screen.getByRole("button", { name: "Start over" }))
    expect(await screen.findByText("Books already imported stay in the library and in History.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear loaded books" }))
    expect(imp.clearLoaded).toHaveBeenCalled()
    expect(imp.clearBatch).not.toHaveBeenCalled()
  })

  it("deletes the whole list when nothing was ever imported", async () => {
    const imp = setup()
    fireEvent.click(screen.getByRole("button", { name: "Start over" }))
    fireEvent.click(await screen.findByRole("button", { name: "Clear loaded books" }))
    expect(imp.clearBatch).toHaveBeenCalled()
    expect(imp.clearLoaded).not.toHaveBeenCalled()
  })
})

describe("a quieter page", () => {
  it("has no sentence about retention above the list, and a small note below it", () => {
    setup()
    expect(screen.queryByText(/books loaded\. The list is kept/)).not.toBeInTheDocument()
    expect(screen.getByText("Kept for 30 days after your last change.")).toBeInTheDocument()
  })

  it("puts Start over beside the tabs", () => {
    setup()
    const tabs = screen.getByRole("tablist")
    expect(tabs.parentElement).toContainElement(screen.getByRole("button", { name: "Start over" }))
  })

  it("hides filters with nothing in them, but keeps All and the one chosen", () => {
    setup({ summary: summary({ counts: { matched: 4 } }) })
    expect(screen.getByRole("button", { name: /^All/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Matched/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^No match/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Duplicate/ })).not.toBeInTheDocument()
  })
})

describe("the list header and selection", () => {
  const rows = [
    { id: 1, title: "Dune", state: "matched", encrypted: false },
    { id: 2, title: "Emma", state: "matched", encrypted: false },
    { id: 3, title: "Ulysses", state: "importing", encrypted: false },
  ]

  it("just counts the books when nothing is selected, with no bulk buttons", () => {
    setup({ rows })
    expect(screen.getByText("4 books")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Remove$|Encrypt|Clear/ })).not.toBeInTheDocument()
  })

  it("shows what can be done once books are selected", () => {
    setup({ rows })
    fireEvent.click(screen.getByLabelText("pick Dune"))
    fireEvent.click(screen.getByLabelText("pick Emma"))
    expect(screen.getByText("2 selected")).toBeInTheDocument()
    for (const name of ["Clear", "Encrypt", "Remove"]) expect(screen.getByRole("button", { name })).toBeInTheDocument()
  })

  it("removes only the selected books after confirming", async () => {
    const imp = setup({ rows })
    fireEvent.click(screen.getByLabelText("pick Dune"))
    fireEvent.click(screen.getByLabelText("pick Emma"))
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(await screen.findByText("Remove 2 selected books from this list?")).toBeInTheDocument()
    expect(imp.removeRows).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(imp.removeRows).toHaveBeenCalledWith([rows[0], rows[1]])
    await waitFor(() => expect(screen.queryByText("2 selected")).not.toBeInTheDocument())
  })

  it("encrypts the selected books, and offers to undo once all of them are encrypted", () => {
    const imp = setup({ rows })
    fireEvent.click(screen.getByLabelText("pick Dune"))
    fireEvent.click(screen.getByRole("button", { name: "Encrypt" }))
    expect(imp.encryptRows).toHaveBeenCalledWith([rows[0]], true)
  })

  it("says Don't encrypt when every selected book is already encrypted", () => {
    const imp = setup({ rows: [{ id: 1, title: "Dune", state: "matched", encrypted: true }] })
    fireEvent.click(screen.getByLabelText("pick Dune"))
    fireEvent.click(screen.getByRole("button", { name: "Don't encrypt" }))
    expect(imp.encryptRows).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })], false)
  })

  it("selects the page, leaving out a book that is importing", () => {
    setup({ rows })
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }))
    expect(screen.getByText("2 selected")).toBeInTheDocument()
  })

  it("offers Select all N in this view when the view is longer than the page, and acts on the whole view", async () => {
    const imp = setup({ rows, total: 120 })
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }))
    fireEvent.click(screen.getByRole("button", { name: "Select all 120 in this view" }))
    expect(screen.getByText("All 4 selected")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Encrypt" }))
    expect(imp.bulk).toHaveBeenCalledWith("set_encrypted", true)
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(await screen.findByText("Remove 4 books from this list?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(imp.bulk).toHaveBeenCalledWith("remove")
  })

  it("does not offer Select all when the page is the whole view", () => {
    setup({ rows, total: 3 })
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }))
    expect(screen.queryByRole("button", { name: /Select all .* in this view/ })).not.toBeInTheDocument()
  })

  it("clears the selection on request and when the filter changes", () => {
    setup({ rows })
    fireEvent.click(screen.getByLabelText("pick Dune"))
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("pick Dune"))
    fireEvent.click(screen.getByRole("button", { name: /^Matched/ }))
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument()
  })

  it("says the header applies to a search, not to a count", () => {
    setup({ rows })
    fireEvent.change(screen.getByLabelText("Search title or file"), { target: { value: "dune" } })
    expect(screen.getByText("Books matching this search")).toBeInTheDocument()
  })
})
