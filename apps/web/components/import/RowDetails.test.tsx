// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { RowDetails, fileSize, openLibraryUrl } from "./RowDetails"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

const row = (over = {}) => ({
  id: 1, path: "ebooks/dune.epub", size: 3 * 1024 * 1024, mtime: 1700000000000, state: "matched", decision: "auto",
  skipped: false, staged: true, encrypted: false, auto_picked: true, confidence: 92, candidates_count: 4,
  title: "Dune", author: "Frank Herbert", isbn: "9780441172719", publisher: "Ace", year: 1965, language: "eng",
  olid: 123, match_title: "Dune (Ace)", match_author: "F. Herbert", ...over,
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

it("shows the Open Library match, the file's own metadata and the file", () => {
  show(row())
  expect(screen.getByRole("link", { name: /OL123M/ })).toHaveAttribute("href", "https://openlibrary.org/books/OL123M")
  expect(screen.getByText("Dune (Ace)", { selector: "dd" })).toBeInTheDocument()
  expect(screen.getByText("Picked automatically")).toBeInTheDocument()
  expect(screen.getByText("92%")).toBeInTheDocument()
  expect(screen.getByText("9780441172719")).toBeInTheDocument()
  expect(screen.getByText("Ace")).toBeInTheDocument()
  expect(screen.getByText("ebooks/dune.epub")).toBeInTheDocument()
  expect(screen.getByText("3.0 MB")).toBeInTheDocument()
  expect(screen.getByText("Yes, it is on the server")).toBeInTheDocument()
})

it("says so when the book is not linked yet, and leaves out empty fields", () => {
  show(row({ olid: null, match_title: null, match_author: null, isbn: null, publisher: null, state: "no_match", candidates_count: 0 }))
  expect(screen.getByText("Not linked yet")).toBeInTheDocument()
  expect(screen.queryByText("ISBN")).not.toBeInTheDocument()
  expect(screen.queryByText("Suggestions")).not.toBeInTheDocument()
  expect(screen.queryByText("Match")).not.toBeInTheDocument()
})

it("says a match was chosen by the admin, with no percentage", () => {
  show(row({ auto_picked: false, decision: "user", confidence: 40 }))
  expect(screen.getByText("Chosen by you")).toBeInTheDocument()
  expect(screen.queryByText("40%")).not.toBeInTheDocument()
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
