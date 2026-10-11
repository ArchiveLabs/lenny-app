// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { BookCard } from "./BookCard"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@/components/BookEditSheet", () => ({ BookEditSheet: ({ children }) => <div data-testid="sheet-trigger">{children}</div> }))
jest.mock("@/components/library/ShareButton", () => ({ ShareButton: ({ title }) => <button>share {title}</button> }))

const book = (over = {}, lenny = {}) => ({
  olid: "OL28933309M", title: "Database Internals", author_name: ["Alex Petrov"], cover_i: 123,
  lenny: { id: 1, openlibrary_edition: 28933309, encrypted: false, formats: "EPUB", available_copies: 1, ...lenny }, ...over,
})

it("shows the title and author but not the Open Library id, which is in the details", () => {
  render(<BookCard book={book()} />)
  expect(screen.getByText("Database Internals")).toBeInTheDocument()
  expect(screen.getByText("Alex Petrov")).toBeInTheDocument()
  expect(screen.queryByText("OL28933309M")).not.toBeInTheDocument()
  expect(screen.queryByText(/OL\d+M/)).not.toBeInTheDocument()
})

it("says Open or DRM", () => {
  const { rerender } = render(<BookCard book={book()} />)
  expect(screen.getByText("Open")).toBeInTheDocument()
  rerender(<BookCard book={book({}, { encrypted: true })} />)
  expect(screen.getByText("DRM")).toBeInTheDocument()
})

it("says how many copies, in words", () => {
  const { rerender } = render(<BookCard book={book()} />)
  expect(screen.getByText("copy")).toBeInTheDocument()
  rerender(<BookCard book={book({}, { available_copies: 3 })} />)
  expect(screen.getByText("copies")).toBeInTheDocument()
  expect(screen.getByText("3")).toBeInTheDocument()
})

it("keeps the copies and the share button together on the right of the footer", () => {
  render(<BookCard book={book()} />)
  const share = screen.getByRole("button", { name: "share Database Internals" })
  expect(share.parentElement).toHaveTextContent("copy")
})

it("offers Share, but not while selecting books", () => {
  const { rerender } = render(<BookCard book={book()} />)
  expect(screen.getByRole("button", { name: /share/ })).toBeInTheDocument()
  rerender(<BookCard book={book()} selectMode selected={false} onSelectChange={jest.fn()} />)
  expect(screen.queryByRole("button", { name: /share/ })).not.toBeInTheDocument()
})

it("opens the book sheet from the card, and picks the book in select mode", () => {
  const onSelectChange = jest.fn()
  const { rerender } = render(<BookCard book={book()} />)
  expect(screen.getByTestId("sheet-trigger")).toBeInTheDocument()
  rerender(<BookCard book={book()} selectMode selected={false} onSelectChange={onSelectChange} />)
  fireEvent.click(screen.getByText("Database Internals"))
  expect(onSelectChange).toHaveBeenCalledWith(true)
})
