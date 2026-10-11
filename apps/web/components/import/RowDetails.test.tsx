// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { RowDetails, fileSize, openLibraryUrl } from "./RowDetails"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))

const row = (over = {}) => ({
  id: 1, path: "ebooks/dune.epub", size: 3 * 1024 * 1024, mtime: 1700000000000, state: "matched", decision: "auto",
  skipped: false, staged: true, encrypted: false, auto_picked: true, confidence: 92, candidates_count: 4,
  title: "Dune", author: "Frank Herbert", isbn: "9780441172719", publisher: "Ace", year: 1965, language: "eng",
  olid: 123, match_title: "Dune (Ace)", match_author: "F. Herbert", match_year: 1966, ...over,
})
const show = (r, over = {}) => {
  const onClose = jest.fn()
  const onChangeEdition = jest.fn()
  render(<RowDetails row={r} onClose={onClose} onChangeEdition={onChangeEdition} {...over} />)
  return { onClose, onChangeEdition }
}

it("renders nothing when no book is chosen", () => {
  show(null)
  expect(screen.queryByText("Open Library")).not.toBeInTheDocument()
})

it("shows the status, the link and the match in the header", () => {
  show(row())
  expect(screen.getByText("Matched")).toBeInTheDocument()
  const link = screen.getAllByRole("link", { name: /OL123M/ })[0]
  expect(link).toHaveAttribute("href", "https://openlibrary.org/books/OL123M")
  expect(screen.getByText("92% match")).toBeInTheDocument()
})

it("compares the file's title and author with Open Library's in a table", () => {
  show(row())
  const table = screen.getByRole("table")
  expect(table).toHaveTextContent("In the file")
  expect(table).toHaveTextContent("On Open Library")
  const rows = screen.getAllByRole("row")
  expect(rows[1]).toHaveTextContent("Dune")
  expect(rows[1]).toHaveTextContent("Dune (Ace)")
  expect(rows[2]).toHaveTextContent("Frank Herbert")
  expect(rows[2]).toHaveTextContent("F. Herbert")
  expect(rows[3]).toHaveTextContent("Publisher")
  expect(rows[3]).toHaveTextContent("Ace") // the file's publisher, so you can see why an edition was chosen
  expect(rows[4]).toHaveTextContent("1965") // the file's year
  expect(rows[4]).toHaveTextContent("1966") // Open Library's
  expect(screen.getByText("4 other editions were suggested.")).toBeInTheDocument()
})

it("shows the file's details and the file itself", () => {
  show(row())
  expect(screen.getByText("9780441172719")).toBeInTheDocument()
  expect(screen.getByText("Ace")).toBeInTheDocument()
  expect(screen.getByText("ebooks/dune.epub")).toBeInTheDocument()
  expect(screen.getByText("3.0 MB")).toBeInTheDocument()
  expect(screen.getByText("Yes, it is on the server")).toBeInTheDocument()
})

it("offers View on Open Library in the footer", () => {
  show(row())
  expect(screen.getByRole("link", { name: /View on Open Library/ })).toHaveAttribute("href", "https://openlibrary.org/books/OL123M")
})

it("says so when the book is not linked yet, shows dashes for the missing side, and leaves out empty fields", () => {
  show(row({ olid: null, match_title: null, match_author: null, isbn: null, publisher: null, state: "no_match", candidates_count: 0 }))
  expect(screen.getByText("Not linked yet")).toBeInTheDocument()
  expect(screen.queryByText("ISBN")).not.toBeInTheDocument()
  expect(screen.queryByText(/other editions were suggested/)).not.toBeInTheDocument()
  expect(screen.queryByText(/% match/)).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: /View on Open Library/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("—")
})

it("says a match was chosen by the admin, with no percentage", () => {
  show(row({ auto_picked: false, decision: "user", confidence: 40 }))
  expect(screen.getByText("Chosen by you")).toBeInTheDocument()
  expect(screen.queryByText("40% match")).not.toBeInTheDocument()
})

it("shows a failure's error", () => {
  show(row({ state: "failed", error: "File is corrupt" }))
  expect(screen.getByRole("alert")).toHaveTextContent("File is corrupt")
})

it("offers Change edition for an editable book, and not for one already imported", () => {
  const { onChangeEdition } = show(row())
  fireEvent.click(screen.getByRole("button", { name: "Change edition" }))
  expect(onChangeEdition).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
})

it("offers no edit once imported", () => {
  show(row({ state: "imported" }))
  expect(screen.queryByRole("button", { name: /edition/i })).not.toBeInTheDocument()
})

it("formats sizes and links", () => {
  expect(fileSize(500)).toBe("1 KB")
  expect(fileSize(150 * 1024)).toBe("150 KB")
  expect(fileSize(5 * 1024 ** 2)).toBe("5.0 MB")
  expect(openLibraryUrl(7)).toBe("https://openlibrary.org/books/OL7M")
})

it("titles a linked book with Open Library's title, or its OL id when there is none yet, never the file's", () => {
  show(row({ match_title: null, match_author: null }))
  expect(screen.getAllByText("OL123M").length).toBeGreaterThan(0)
  expect(screen.queryByText("Frank Herbert", { selector: "p" })).not.toBeInTheDocument()
})

it("lists the file's other ISBNs next to the first", () => {
  show(row({ isbn: "9780441172719", isbn_alt: "9780441013593 9780451524935" }))
  expect(screen.getByText("9780441172719, 9780441013593, 9780451524935")).toBeInTheDocument()
})
