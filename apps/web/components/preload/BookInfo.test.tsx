// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { BookInfo, BookInfoLoader } from "./BookInfo"
import { useLibraryBookMetadata } from "@/hooks/preload/use-preload"
import { ApiError } from "@/types/api"

jest.mock("@/hooks/preload/use-preload")
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@/lib/api-client", () => ({ redirectToLogin: jest.fn() }))

const data = (over = {}) => ({
  olid: 7, title: "Database Internals", authors: ["Alex Petrov"], subjects: [], source_id: null, size: null, in_library: true, is_new: false,
  publisher: "O'Reilly", publish_date: "2019", pages: 373, isbn: "9781492040347", languages: ["eng"], description: "About databases.",
  all_subjects: ["Databases"], subjects: [], added_at: null, links: { open_library: "https://openlibrary.org/books/OL7M" }, details_loaded: true, ...over,
})
const state = (over = {}) => ({ data: undefined, isLoading: false, isError: false, isFetching: false, error: null, refetch: jest.fn(), ...over })

describe("BookInfo", () => {
  it("shows the rows, description, subjects and links for a book that is not from Standard Ebooks", () => {
    render(<BookInfo data={data()} subjects={["Databases"]} />)
    expect(screen.getByText("Publisher").nextElementSibling).toHaveTextContent("O'Reilly")
    expect(screen.getByText("Pages").nextElementSibling).toHaveTextContent("373")
    expect(screen.getByText("Languages").nextElementSibling).toHaveTextContent("English")
    expect(screen.getByText("About databases.")).toBeInTheDocument()
    expect(screen.getByText("Databases")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Library" })).toHaveAttribute("href", "https://openlibrary.org/books/OL7M")
  })

  it("does not name a source for a book that is not from Standard Ebooks, nor show a size or archive date", () => {
    render(<BookInfo data={data()} subjects={[]} />)
    for (const label of ["Source", "Size", "Added to the archive"]) expect(screen.queryByText(label)).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Standard Ebooks" })).not.toBeInTheDocument()
  })

  it("names the source for a Standard Ebooks book", () => {
    render(<BookInfo data={data({ source_id: "a/b" })} subjects={[]} />)
    expect(screen.getByText("Source").nextElementSibling).toHaveTextContent("Standard Ebooks via archive.org")
  })
})

describe("BookInfoLoader", () => {
  it("shows a skeleton while loading", () => {
    useLibraryBookMetadata.mockReturnValue(state({ isLoading: true }))
    render(<BookInfoLoader olid={7} />)
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
  })

  it("shows nothing when no book is asked for", () => {
    useLibraryBookMetadata.mockReturnValue(state())
    const { container } = render(<BookInfoLoader olid={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("says the book is no longer in the library on a 404, with no retry, and tells the page", () => {
    const onGone = jest.fn()
    useLibraryBookMetadata.mockReturnValue(state({ isError: true, error: new ApiError("That book is not in your library.", 404) }))
    render(<BookInfoLoader olid={7} onGone={onGone} />)
    expect(screen.getByText("This book is no longer in your library.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
    expect(onGone).toHaveBeenCalled()
  })

  it("does not tell the page about other failures", () => {
    const onGone = jest.fn()
    useLibraryBookMetadata.mockReturnValue(state({ isError: true, error: new ApiError("boom", 500) }))
    render(<BookInfoLoader olid={7} onGone={onGone} />)
    expect(onGone).not.toHaveBeenCalled()
  })

  it("says no more details are available when Open Library knew nothing about the book", () => {
    useLibraryBookMetadata.mockReturnValue(state({ data: data({ publisher: null, publish_date: null, pages: null, isbn: null, languages: [], description: null, all_subjects: [], subjects: [], links: {}, source_id: null }) }))
    render(<BookInfoLoader olid={7} />)
    expect(screen.getByText("No more details are available for this book.")).toBeInTheDocument()
  })

  it("does not say that when even a link is known", () => {
    useLibraryBookMetadata.mockReturnValue(state({ data: data({ publisher: null, publish_date: null, pages: null, isbn: null, languages: [], description: null, all_subjects: [], subjects: [] }) }))
    render(<BookInfoLoader olid={7} />)
    expect(screen.queryByText("No more details are available for this book.")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Library" })).toBeInTheDocument()
  })

  it("retries after a failure and then shows the details", () => {
    const hook = state({ isError: true, error: new ApiError("bad gateway", 502) })
    useLibraryBookMetadata.mockReturnValue(hook)
    render(<BookInfoLoader olid={7} />)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(hook.refetch).toHaveBeenCalledTimes(1)
  })

  it("shows other errors with a retry", () => {
    const hook = state({ isError: true, error: new ApiError("bad gateway", 502) })
    useLibraryBookMetadata.mockReturnValue(hook)
    render(<BookInfoLoader olid={7} />)
    expect(screen.getByRole("alert")).toHaveTextContent("Open Library did not answer. Try again in a moment.")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(hook.refetch).toHaveBeenCalled()
  })

  it("says more is unavailable, with a retry, when Open Library did not answer", () => {
    const hook = state({ data: data({ details_loaded: false, publisher: null, pages: null }) })
    useLibraryBookMetadata.mockReturnValue(hook)
    render(<BookInfoLoader olid={7} />)
    expect(screen.getByText(/More details unavailable right now/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(hook.refetch).toHaveBeenCalled()
  })

  it("shows the details when loaded, using the work's subjects, else the book's", () => {
    useLibraryBookMetadata.mockReturnValue(state({ data: data({ all_subjects: [], subjects: ["Fiction"] }) }))
    render(<BookInfoLoader olid={7} />)
    expect(screen.getByText("Fiction")).toBeInTheDocument()
    expect(screen.queryByText(/More details unavailable/)).not.toBeInTheDocument()
  })
})
