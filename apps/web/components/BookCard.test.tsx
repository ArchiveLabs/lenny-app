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

describe("what the card shows", () => {
  it("shows the cover, title and author", () => {
    render(<BookCard book={book()} />)
    expect(screen.getByRole("img", { name: "Database Internals cover" })).toHaveAttribute("src", "https://covers.openlibrary.org/b/id/123-M.jpg")
    expect(screen.getByText("Database Internals")).toBeInTheDocument()
    expect(screen.getByText("Alex Petrov")).toBeInTheDocument()
  })

  it("keeps the cover in a 2:3 frame, the same shape as the free books cards", () => {
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

  it("leaves out what repeats on every card: the Open badge, the format, the copy count and the OL id", () => {
    const { container } = render(<BookCard book={book()} />)
    expect(screen.queryByText("Open")).not.toBeInTheDocument()
    expect(screen.queryByText("EPUB")).not.toBeInTheDocument()
    expect(screen.queryByText(/cop(y|ies)/)).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/OL\d+M/)
  })

  it("never shows undefined, whatever the record is missing", () => {
    const { container } = render(<BookCard book={book({}, { available_copies: undefined, formats: undefined })} />)
    expect(container.textContent).not.toMatch(/undefined|NaN|null/)
  })
})

describe("the lock", () => {
  it("flags only an encrypted book, as DRM", () => {
    const { rerender } = render(<BookCard book={book()} />)
    expect(screen.queryByText("DRM")).not.toBeInTheDocument()
    rerender(<BookCard book={book({}, { encrypted: true })} />)
    expect(screen.getByText("DRM")).toBeInTheDocument()
  })
})

describe("availability", () => {
  it("says Available when a copy is free", () => {
    render(<BookCard book={book({}, { available_copies: 2 })} />)
    expect(screen.getByText("Available")).toBeInTheDocument()
    expect(screen.queryByText("On loan")).not.toBeInTheDocument()
  })

  it("says On loan when no copy is free (a count of zero is a count)", () => {
    render(<BookCard book={book({}, { available_copies: 0 })} />)
    expect(screen.getByText("On loan")).toBeInTheDocument()
  })

  it("says nothing when the record has no count, rather than guessing", () => {
    render(<BookCard book={book({}, { available_copies: undefined })} />)
    expect(screen.queryByText("Available")).not.toBeInTheDocument()
    expect(screen.queryByText("On loan")).not.toBeInTheDocument()
  })

  it("colours the dot green or amber", () => {
    const { container, rerender } = render(<BookCard book={book({}, { available_copies: 1 })} />)
    expect(container.querySelector(".bg-green-500")).toBeInTheDocument()
    rerender(<BookCard book={book({}, { available_copies: 0 })} />)
    expect(container.querySelector(".bg-amber-500")).toBeInTheDocument()
  })
})

describe("Share", () => {
  it("sits over the cover, hidden until hover or focus, and always shown on touch screens", () => {
    const { container } = render(<BookCard book={book()} />)
    const cover = container.querySelector(".aspect-\\[2\\/3\\]")
    const share = screen.getByText("share Database Internals")
    expect(cover).toContainElement(share)
    const bar = share.closest(".opacity-0")
    expect(bar.className).toContain("group-hover:opacity-100")
    expect(bar.className).toContain("focus-within:opacity-100")
    expect(bar.className).toContain("[@media(hover:none)]:opacity-100")
  })

  it("is not shown while selecting", () => {
    render(<BookCard book={book()} selectMode selected={false} onSelectChange={jest.fn()} />)
    expect(screen.queryByText(/^share /)).not.toBeInTheDocument()
  })

  it("does not open the book when pressed", () => {
    const onTile = jest.fn()
    render(<div onClick={onTile}><BookCard book={book()} /></div>)
    fireEvent.click(screen.getByText("share Database Internals"))
    expect(onTile).not.toHaveBeenCalled()
  })
})

describe("selecting", () => {
  it("has a checkbox on the cover only while selecting", () => {
    const { rerender } = render(<BookCard book={book()} />)
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    rerender(<BookCard book={book()} selectMode selected onSelectChange={jest.fn()} />)
    expect(screen.getByRole("checkbox", { name: "Select Database Internals" })).toBeChecked()
  })

  it("picks the book from a click anywhere on the tile", () => {
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

  it("rings the cover when picked", () => {
    const { container } = render(<BookCard book={book()} selectMode selected onSelectChange={jest.fn()} />)
    expect(container.querySelector(".aspect-\\[2\\/3\\]").className).toContain("ring-primary")
  })

  it("does not ring the cover when not picked", () => {
    const { container } = render(<BookCard book={book()} selectMode selected={false} onSelectChange={jest.fn()} />)
    expect(container.querySelector(".aspect-\\[2\\/3\\]").className).not.toContain("ring-primary")
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
