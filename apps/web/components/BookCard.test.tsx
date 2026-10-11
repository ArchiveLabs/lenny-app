// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { BookCard, BookCardSkeleton } from "./BookCard"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@/components/BookEditSheet", () => ({ BookEditSheet: ({ children }) => <div data-testid="sheet-trigger">{children}</div> }))
jest.mock("@/components/library/ShareButton", () => ({ ShareButton: ({ title }) => <button>share {title}</button> }))

const book = (over = {}, lenny = {}) => ({
  olid: "OL28933309M", title: "Database Internals", author_name: ["Alex Petrov"], cover_i: 123,
  lenny: { id: 1, openlibrary_edition: 28933309, encrypted: false, formats: "EPUB", available_copies: 1, ...lenny }, ...over,
})

describe("a cover tile", () => {
  it("shows the cover, title and author", () => {
    render(<BookCard book={book()} />)
    expect(screen.getByRole("img", { name: "Database Internals cover" })).toHaveAttribute("src", "https://covers.openlibrary.org/b/id/123-M.jpg")
    expect(screen.getByText("Database Internals")).toBeInTheDocument()
    expect(screen.getByText("Alex Petrov")).toBeInTheDocument()
  })

  it("puts the cover in a 2:3 frame, the same shape as the free books cards", () => {
    const { container } = render(<BookCard book={book()} />)
    expect(container.querySelector(".aspect-\\[2\\/3\\]")).toBeInTheDocument()
  })

  it("shows a placeholder when there is no cover", () => {
    render(<BookCard book={book({ cover_i: null })} />)
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("says Unknown Author when there is none", () => {
    render(<BookCard book={book({ author_name: [] })} />)
    expect(screen.getByText("Unknown Author")).toBeInTheDocument()
  })

  it("does not show the Open Library id, which is in the details", () => {
    render(<BookCard book={book()} />)
    expect(screen.queryByText(/OL\d+M/)).not.toBeInTheDocument()
  })
})

describe("access and copies", () => {
  it("says Open on the cover, or DRM for an encrypted book", () => {
    const { rerender } = render(<BookCard book={book()} />)
    expect(screen.getByText("Open")).toBeInTheDocument()
    rerender(<BookCard book={book({}, { encrypted: true })} />)
    expect(screen.getByText("DRM")).toBeInTheDocument()
    expect(screen.queryByText("Open")).not.toBeInTheDocument()
  })

  it("says the format, and not how many copies: that is in the book sheet", () => {
    const { rerender } = render(<BookCard book={book()} />)
    expect(screen.getByText("EPUB")).toBeInTheDocument()
    expect(screen.queryByText(/cop(y|ies)/)).not.toBeInTheDocument()
    rerender(<BookCard book={book({}, { formats: "EPUB_PDF", available_copies: 3 })} />)
    expect(screen.getByText("EPUB + PDF")).toBeInTheDocument()
    expect(screen.queryByText(/cop(y|ies)/)).not.toBeInTheDocument()
  })

  it("never shows undefined, whatever the record is missing", () => {
    const { container } = render(<BookCard book={book({}, { available_copies: undefined, formats: undefined })} />)
    expect(container.textContent).not.toMatch(/undefined|NaN|null/)
  })

  it("shows no format line for a format it does not know", () => {
    render(<BookCard book={book({}, { formats: "1" })} />)
    expect(screen.queryByText("1")).not.toBeInTheDocument()
  })
})

describe("share and selecting", () => {
  it("has Share on the cover, but not while selecting", () => {
    const { rerender } = render(<BookCard book={book()} />)
    expect(screen.getByText("share Database Internals")).toBeInTheDocument()
    rerender(<BookCard book={book()} selectMode selected={false} onSelectChange={jest.fn()} />)
    expect(screen.queryByText(/^share /)).not.toBeInTheDocument()
  })

  it("has a checkbox on the cover only while selecting", () => {
    const { rerender } = render(<BookCard book={book()} />)
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    rerender(<BookCard book={book()} selectMode selected onSelectChange={jest.fn()} />)
    expect(screen.getByRole("checkbox", { name: "Select Database Internals" })).toBeChecked()
  })

  it("picks the book from a click anywhere on the tile while selecting", () => {
    const onSelectChange = jest.fn()
    render(<BookCard book={book()} selectMode selected={false} onSelectChange={onSelectChange} />)
    fireEvent.click(screen.getByText("Database Internals"))
    expect(onSelectChange).toHaveBeenCalledWith(true)
  })

  it("does not pick twice from a click on the checkbox itself", () => {
    const onSelectChange = jest.fn()
    render(<BookCard book={book()} selectMode selected={false} onSelectChange={onSelectChange} />)
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Database Internals" }))
    expect(onSelectChange).toHaveBeenCalledTimes(1)
  })

  it("rings the tile when it is picked", () => {
    const { container } = render(<BookCard book={book()} selectMode selected onSelectChange={jest.fn()} />)
    expect(container.querySelector('[role="button"]')!.className).toContain("ring-primary")
  })
})

describe("opening the book", () => {
  it("opens the book sheet from the tile", () => {
    render(<BookCard book={book()} />)
    expect(screen.getByTestId("sheet-trigger")).toBeInTheDocument()
  })

  it("is a button for the keyboard: focusable, and Enter or Space clicks it", () => {
    render(<BookCard book={book()} />)
    const tile = screen.getByTestId("sheet-trigger").firstElementChild
    expect(tile).toHaveAttribute("role", "button")
    expect(tile).toHaveAttribute("tabindex", "0")
    const click = jest.fn()
    tile.addEventListener("click", click)
    fireEvent.keyDown(tile, { key: "Enter" })
    fireEvent.keyDown(tile, { key: " " })
    fireEvent.keyDown(tile, { key: "a" })
    expect(click).toHaveBeenCalledTimes(2)
  })

  it("does not click the tile when Enter is pressed on the Share button inside it", () => {
    render(<BookCard book={book()} />)
    const tile = screen.getByTestId("sheet-trigger").firstElementChild
    const click = jest.fn()
    tile.addEventListener("click", click)
    fireEvent.keyDown(screen.getByText("share Database Internals"), { key: "Enter" })
    expect(click).not.toHaveBeenCalled()
  })
})

it("has a skeleton in the same shape", () => {
  const { container } = render(<BookCardSkeleton />)
  expect(container.querySelector(".aspect-\\[2\\/3\\]")).toBeInTheDocument()
})

describe("where Share sits", () => {
  it("is in a quiet bottom row of the card, not on the cover", () => {
    const { container } = render(<BookCard book={book()} />)
    const cover = container.querySelector(".aspect-\\[2\\/3\\]")
    expect(cover).not.toContainElement(screen.getByText("share Database Internals"))
    const row = screen.getByText("share Database Internals").closest(".justify-between")
    expect(row).toHaveTextContent("EPUB")
  })

  it("is still there, on the right, when the format is not known", () => {
    render(<BookCard book={book({}, { formats: "1" })} />)
    expect(screen.getByText("share Database Internals")).toBeInTheDocument()
  })

  it("leaves the bottom row out while selecting a book with no known format", () => {
    const { container } = render(<BookCard book={book({}, { formats: "1" })} selectMode selected={false} onSelectChange={jest.fn()} />)
    expect(container.querySelector(".justify-between")).not.toBeInTheDocument()
  })

  it("keeps the format in the bottom row while selecting, with no Share", () => {
    render(<BookCard book={book()} selectMode selected={false} onSelectChange={jest.fn()} />)
    expect(screen.getByText("EPUB")).toBeInTheDocument()
    expect(screen.queryByText(/^share /)).not.toBeInTheDocument()
  })

  it("has no bubble around Share", () => {
    render(<BookCard book={book()} />)
    const share = screen.getByText("share Database Internals")
    expect(share.parentElement!.className).not.toContain("rounded-full")
    expect(share.parentElement!.className).not.toContain("bg-background")
  })
})
