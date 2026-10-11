// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { RowItem } from "./RowItem"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))

const row = (over = {}) => ({
  id: 1, path: "L/a.epub", size: 1, mtime: 1, state: "matched", decision: "auto", skipped: false, staged: false,
  encrypted: false, auto_picked: true, confidence: 100, candidates_count: 0, title: "Dune", match_title: "Dune", ...over,
})
const show = (r, props = {}) => {
  const fns = { onOpen: jest.fn(), onDetails: jest.fn(), onRemove: jest.fn(), onToggleEncrypted: jest.fn(), onSelect: jest.fn(), onRetryUpload: jest.fn() }
  const ui = (p) => <RowItem row={r} needsFile={false} selected={false} {...fns} {...p} />
  const view = render(ui(props))
  return { ...fns, ...view, again: (p) => view.rerender(ui(p)) }
}

describe("status badge shows only what needs attention", () => {
  it("shows nothing for a good auto-match", () => {
    show(row({ confidence: 100 }))
    expect(screen.queryByText(/Matched|Check|%/)).not.toBeInTheDocument()
  })

  it("shows nothing at 95 and above, even when auto-picked", () => {
    show(row({ confidence: 95 }))
    expect(screen.queryByText("Check")).not.toBeInTheDocument()
  })

  it("shows Check, with the percentage as a tooltip, for an auto-pick under 95", () => {
    show(row({ confidence: 92 }))
    expect(screen.getByText("Check").closest("[title]")).toHaveAttribute("title", "92% match")
  })

  it("shows nothing for a match the admin chose, whatever its score", () => {
    show(row({ auto_picked: false, decision: "user", confidence: 40 }))
    expect(screen.queryByText("Check")).not.toBeInTheDocument()
  })

  it.each([
    ["needs_review", "Needs review"],
    ["no_match", "No match"],
    ["duplicate", "In library"],
    ["failed", "Failed"],
    ["importing", "Importing"],
    ["imported", "Imported"],
    ["queued", "Matching"],
  ])("shows %s as %s", (state, label) => {
    show(row({ state }))
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it("puts a failure's error under the title", () => {
    show(row({ state: "failed", error: "File is corrupt" }))
    expect(screen.getByText("File is corrupt")).toBeInTheDocument()
  })

  it("never says Matched or Uploaded", () => {
    show(row({ staged: true }))
    expect(screen.queryByText(/Matched|Uploaded/)).not.toBeInTheDocument()
  })
})

describe("upload state", () => {
  it("shows nothing once uploaded", () => {
    show(row({ staged: true }))
    expect(screen.queryByRole("img", { name: "Uploading" })).not.toBeInTheDocument()
    expect(screen.queryByText("Not uploaded")).not.toBeInTheDocument()
  })

  it("shows a spinner while uploading", () => {
    show(row(), { upload: "uploading" })
    expect(screen.getByRole("img", { name: "Uploading" })).toBeInTheDocument()
  })

  it("shows Not uploaded with a retry when it gave up", () => {
    const { onRetryUpload } = show(row(), { upload: "failed" })
    fireEvent.click(screen.getByRole("button", { name: "Not uploaded" }))
    expect(onRetryUpload).toHaveBeenCalled()
  })
})

describe("controls are icons", () => {
  it("Remove is a trash icon with a label and a tooltip, no word", () => {
    const { onRemove } = show(row())
    const remove = screen.getByRole("button", { name: "Remove Dune from this list" })
    expect(remove).toHaveAttribute("title", "The book is not imported. Drop the file again to bring it back.")
    expect(remove).toHaveTextContent("")
    fireEvent.click(remove)
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })

  it("Change edition is a pencil icon for a matched row", () => {
    const { onOpen } = show(row())
    const edit = screen.getByRole("button", { name: "Change edition for Dune" })
    expect(edit).toHaveTextContent("")
    expect(screen.queryByText("Choose edition")).not.toBeInTheDocument()
    fireEvent.click(edit)
    expect(onOpen).toHaveBeenCalled()
  })

  it.each(["needs_review", "no_match"])("a %s row gets a text Choose edition button, since that is the main task", (state) => {
    show(row({ state }))
    expect(screen.getByRole("button", { name: "Choose edition" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Change edition for/ })).not.toBeInTheDocument()
  })

  it("Encrypt is a lock toggle with aria-pressed and a tooltip", () => {
    const { onToggleEncrypted } = show(row())
    const lock = screen.getByRole("button", { name: "Encrypt Dune" })
    expect(lock).toHaveAttribute("aria-pressed", "false")
    expect(lock).toHaveAttribute("title", "Encrypt: readers must log in")
    fireEvent.click(lock)
    expect(onToggleEncrypted).toHaveBeenCalled()
  })

  it("shows the lock as pressed when encrypted", () => {
    show(row({ encrypted: true }))
    expect(screen.getByRole("button", { name: "Encrypt Dune" })).toHaveAttribute("aria-pressed", "true")
  })

  it("has no lock or edit for a book already in the library, and no Remove while importing", () => {
    show(row({ state: "duplicate" }))
    expect(screen.queryByRole("button", { name: "Encrypt Dune" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Change edition for/ })).not.toBeInTheDocument()
  })

  it("has no Remove while the book is importing", () => {
    show(row({ state: "importing" }))
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument()
  })

  it("gives every icon button a 44px target on narrow screens", () => {
    show(row())
    for (const name of ["Encrypt Dune", "Change edition for Dune", "Remove Dune from this list"]) {
      expect(screen.getByRole("button", { name }).className).toContain("h-11 w-11")
    }
  })
})

describe("selection", () => {
  it("reports the choice", () => {
    const { onSelect } = show(row())
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Dune" }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), true)
  })

  it("is disabled while importing", () => {
    show(row({ state: "importing" }))
    expect(screen.getByRole("checkbox", { name: "Select Dune" })).toBeDisabled()
  })

  it("keeps a light highlight when selected", () => {
    const { container } = show(row(), { selected: true })
    expect(container.firstChild.className).toContain("bg-muted/40")
  })
})

it("asks for the file again only when it is neither staged nor in memory", () => {
  const { again } = show(row(), { needsFile: true })
  expect(screen.getByText("Drop this file again to import it")).toBeInTheDocument()
  again({ row: row({ staged: true }), needsFile: true })
  expect(screen.queryByText("Drop this file again to import it")).not.toBeInTheDocument()
})

describe("link to Open Library and details", () => {
  it("shows a linked check with the OL id that opens the edition", () => {
    show(row({ olid: 3413631, match_author: "Ben Ehrenreich", match_year: 1900 }))
    const link = screen.getByRole("link", { name: /OL3413631M/ })
    expect(link).toHaveAttribute("href", "https://openlibrary.org/books/OL3413631M")
    expect(link).toHaveAttribute("title", "Linked to Open Library")
    expect(screen.getByText("Ben Ehrenreich · 1900")).toBeInTheDocument()
  })

  it("shows no link for a book with no Open Library match", () => {
    show(row({ olid: null, state: "no_match" }))
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("has an arrow button that opens the details", () => {
    const { onDetails } = show(row())
    fireEvent.click(screen.getByRole("button", { name: "Show details for Dune" }))
    expect(onDetails).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })

  it("keeps the arrow even while importing", () => {
    show(row({ state: "importing" }))
    expect(screen.getByRole("button", { name: "Show details for Dune" })).toBeInTheDocument()
  })
})

describe("alignment", () => {
  const names = () => screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") || b.textContent)

  it("keeps the controls in one order: lock, pencil, trash, arrow last", () => {
    show(row({ olid: 5 }))
    expect(names().filter((n) => /Encrypt|Change edition|Remove|details/.test(n))).toEqual([
      "Encrypt Dune", "Change edition for Dune", "Remove Dune from this list", "Show details for Dune",
    ])
  })

  it("puts the Open Library id with the controls, not in the author line", () => {
    show(row({ olid: 5, match_author: "Frank Herbert" }))
    const line = screen.getByText("Frank Herbert")
    expect(line.closest("p")).not.toContainElement(screen.getByRole("link", { name: /OL5M/ }))
  })

  it("holds the columns of absent controls so the rest do not shift", () => {
    const { container } = show(row({ state: "duplicate", olid: null }))
    // no OL id, lock or pencil: three placeholders stand in for them
    expect(container.querySelectorAll("span[aria-hidden].hidden")).toHaveLength(3)
  })

  it("keeps the Choose edition button out of the fixed columns for a row that needs review", () => {
    show(row({ state: "needs_review", olid: null }))
    expect(screen.getByRole("button", { name: "Choose edition" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Change edition for/ })).not.toBeInTheDocument()
  })
})

it("left-aligns the Open Library id in its column so the check icons line up", () => {
  show(row({ olid: 5 }))
  const link = screen.getByRole("link", { name: /OL5M/ })
  expect(link.className).toContain("justify-start")
  expect(link.className).not.toContain("justify-end")
  expect(link.className).toContain("@2xl:w-40")
})

describe("what a row shows", () => {
  it("shows Open Library's title, author and year for a linked book", () => {
    show(row({ olid: 5, title: "File title", author: "File Author", year: 1900, match_title: "Matched title", match_author: "Matched Author", match_year: 1965 }))
    expect(screen.getByText("Matched title")).toBeInTheDocument()
    expect(screen.getByText("Matched Author · 1965")).toBeInTheDocument()
    expect(screen.queryByText(/File title|File Author|1900/)).not.toBeInTheDocument()
  })

  it("never shows the file's year, and shows no year when the match has none", () => {
    show(row({ olid: 5, author: "F", match_author: "Frank Herbert", year: 1900, match_year: null }))
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument()
    expect(screen.queryByText(/1900/)).not.toBeInTheDocument()
  })

  it("shows the OL id in the title's place when a linked book has no matched title yet (old data)", () => {
    show(row({ olid: 5, title: "Game Show Zine", match_title: null, match_author: null }))
    expect(screen.getAllByText("OL5M").length).toBeGreaterThan(0)
    expect(screen.queryByText("Game Show Zine")).not.toBeInTheDocument()
  })

  it("does not borrow the file's author for a linked book", () => {
    show(row({ olid: 5, author: "File Author", match_author: null }))
    expect(screen.queryByText("File Author")).not.toBeInTheDocument()
  })

  it("shows the file's own title and author, but no year, for a book with no match", () => {
    show(row({ olid: null, state: "no_match", title: "Game Show Zine", author: "Joe MacLeod", year: 1900, match_title: null }))
    expect(screen.getByText("Game Show Zine")).toBeInTheDocument()
    expect(screen.getByText("Joe MacLeod")).toBeInTheDocument()
    expect(screen.queryByText(/1900/)).not.toBeInTheDocument()
  })

  it("falls back to the file name when an unlinked book has no title", () => {
    show(row({ olid: null, state: "no_match", title: null, path: "L/zine.epub", match_title: null }))
    expect(screen.getByText("zine.epub")).toBeInTheDocument()
  })
})
