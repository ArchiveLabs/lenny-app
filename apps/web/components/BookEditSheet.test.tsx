// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BookEditSheet } from "./BookEditSheet"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock("@/lib/api-client", () => ({
  ...jest.requireActual("@/lib/api-client"),
  fetchAdmin: jest.fn(() => new Promise(() => {})), // the loan limits are not what this tests
}))
jest.mock("@/components/UploadComponents", () => ({ EncryptionToggle: () => <div /> }))
const loader = jest.fn()
jest.mock("@/components/preload/BookInfo", () => ({ BookInfoLoader: (p) => (loader(p), <div>info for {String(p.olid)}</div>) }))

const book = {
  olid: "OL28933309M", title: "Database Internals", author_name: ["Alex Petrov"],
  lenny: { id: 1, openlibrary_edition: 28933309, encrypted: false, formats: "epub", created_at: "", updated_at: "", is_borrowable: true, is_readable: true, is_lendable: true, available_copies: 1 },
}
const open = () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BookEditSheet book={book}><button>open</button></BookEditSheet>
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByText("open"))
}

beforeEach(() => loader.mockClear())

it("has a Book details section, closed at first", () => {
  open()
  const summary = screen.getByText("Book details")
  expect(summary.closest("details")).not.toHaveAttribute("open")
})

it("asks for nothing until the section is opened, so Open Library is not queried for every sheet", () => {
  open()
  expect(loader).toHaveBeenCalled()
  expect(loader.mock.calls.every(([p]) => p.olid === null)).toBe(true)
})

it("loads the details for this book's edition number when opened", () => {
  open()
  const details = screen.getByText("Book details").closest("details")
  details.open = true
  fireEvent(details, new Event("toggle"))
  expect(loader).toHaveBeenLastCalledWith(expect.objectContaining({ olid: 28933309 }))
  expect(screen.getByText("info for 28933309")).toBeInTheDocument()
})

it("keeps the existing sections: wrong edition and danger zone", () => {
  open()
  expect(screen.getByText("Wrong edition or file attached?")).toBeInTheDocument()
  expect(screen.getByText("Danger zone")).toBeInTheDocument()
})

it("brings the Library list up to date when the book turns out to be gone", () => {
  open()
  const props = loader.mock.calls.at(-1)[0]
  expect(typeof props.onGone).toBe("function")
})
