// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { BookDetails, languageName } from "./BookDetails"
import { usePreloadBook } from "@/hooks/preload/use-preload"
import { ApiError } from "@/types/api"

jest.mock("@/hooks/preload/use-preload")
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))
jest.mock("@/lib/api-client", () => ({ redirectToLogin: jest.fn() }))

const MB = 1024 ** 2
const listed = { olid: 7, title: "Pride and Prejudice", authors: ["Jane Austen"], year: 1813, cover_url: "/c.jpg", subjects: ["Fiction"], source_id: "jane-austen/pride", size: 2 * MB, in_library: false, is_new: false }
const full = (over = {}) => ({
  ...listed, cover_url_large: "/big.jpg", publisher: "Standard Ebooks", publish_date: "2014-05-25", pages: 380, isbn: "9780000000002",
  languages: ["eng", "fre"], description: "A short description.", all_subjects: ["Fiction", "Romance"], added_at: "2026-10-01T12:00:00Z",
  links: { open_library: "https://openlibrary.org/books/OL7M", standard_ebooks: "https://standardebooks.org/ebooks/jane-austen/pride", archive_org: "https://archive.org/details/x" },
  details_loaded: true, ...over,
})
const state = (over = {}) => ({ data: undefined, isLoading: false, isError: false, isFetching: false, error: null, refetch: jest.fn(), ...over })
const show = (hook, props = {}) => {
  usePreloadBook.mockReturnValue(hook)
  const fns = { onAdd: jest.fn(), onClose: jest.fn(), onGone: jest.fn() }
  render(<BookDetails olid={7} listed={listed} {...fns} {...props} />)
  return { ...fns, refetch: hook.refetch }
}

beforeEach(() => jest.clearAllMocks())

it("renders nothing when no book is chosen", () => {
  usePreloadBook.mockReturnValue(state())
  render(<BookDetails olid={null} onAdd={jest.fn()} onClose={jest.fn()} onGone={jest.fn()} />)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

describe("while loading", () => {
  it("shows the header from the catalog at once, and skeleton rows", () => {
    show(state({ isLoading: true }))
    expect(screen.getByText("Pride and Prejudice")).toBeInTheDocument()
    expect(screen.getByText("Jane Austen")).toBeInTheDocument()
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument()
    expect(screen.queryByText("Publisher")).not.toBeInTheDocument()
  })
})

describe("loaded", () => {
  it("shows the cover (the large one), title, authors and year", () => {
    show(state({ data: full() }))
    expect(screen.getByText("Pride and Prejudice")).toBeInTheDocument()
    expect(screen.getByText("Jane Austen")).toBeInTheDocument()
    expect(screen.getByText("1813")).toBeInTheDocument()
    expect(document.querySelector("img")).toHaveAttribute("src", "/big.jpg")
  })

  it("falls back to the catalog cover when there is no large one", () => {
    show(state({ data: full({ cover_url_large: null }) }))
    expect(document.querySelector("img")).toHaveAttribute("src", "/c.jpg")
  })

  it("shows every row", () => {
    show(state({ data: full() }))
    const rows = {
      Publisher: "Standard Ebooks", Published: "2014-05-25", Pages: "380", ISBN: "9780000000002", Languages: "English, French",
      Size: "2.0 MB", "Added to the archive": "Oct 1, 2026", Source: "Standard Ebooks via archive.org",
    }
    for (const [label, value] of Object.entries(rows)) {
      expect(screen.getByText(label).nextElementSibling).toHaveTextContent(value)
    }
  })

  it("shows the description and the subjects as chips", () => {
    show(state({ data: full() }))
    expect(screen.getByText("A short description.")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Fiction", "Romance"])
  })

  it("links to Open Library, Standard Ebooks and archive.org in a new tab", () => {
    show(state({ data: full() }))
    for (const [name, href] of [["Open Library", "https://openlibrary.org/books/OL7M"], ["Standard Ebooks", "https://standardebooks.org/ebooks/jane-austen/pride"], ["archive.org", "https://archive.org/details/x"]]) {
      const link = screen.getByRole("link", { name })
      expect(link).toHaveAttribute("href", href)
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noopener noreferrer")
    }
  })

  it("shows the New and In library badges", () => {
    show(state({ data: full({ is_new: true, in_library: true }) }))
    expect(screen.getByText("New")).toBeInTheDocument()
    expect(screen.getByText("In library")).toBeInTheDocument()
  })
})

describe("empty fields", () => {
  it("hides rows that are null, empty or zero instead of showing null or 0 MB", () => {
    show(state({ data: full({ publisher: null, pages: null, isbn: null, publish_date: null, languages: [], size: 0, added_at: null, description: null, links: {} }) }))
    for (const label of ["Publisher", "Published", "Pages", "ISBN", "Languages", "Size", "Added to the archive"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    expect(screen.getByText("Source")).toBeInTheDocument()
    expect(screen.queryByText(/null|0 MB/)).not.toBeInTheDocument()
    expect(screen.queryByText("About this book")).not.toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Links" })).not.toBeInTheDocument()
  })

  it("shows no Subjects heading when there are none", () => {
    show(state({ data: full({ all_subjects: [], subjects: [] }) }))
    expect(screen.queryByText("Subjects")).not.toBeInTheDocument()
  })

  it("falls back to the catalog's subjects when the work has none", () => {
    show(state({ data: full({ all_subjects: [] }) }))
    expect(screen.getByText("Fiction")).toBeInTheDocument()
  })
})

describe("the description", () => {
  it("is folded after about six lines, with Show more and Show less", () => {
    show(state({ data: full({ description: "word ".repeat(200) }) }))
    const text = screen.getByText(/word word/)
    expect(text.className).toContain("line-clamp-6")
    fireEvent.click(screen.getByRole("button", { name: "Show more" }))
    expect(text.className).not.toContain("line-clamp-6")
    fireEvent.click(screen.getByRole("button", { name: "Show less" }))
    expect(text.className).toContain("line-clamp-6")
  })

  it("is not folded when it is short", () => {
    show(state({ data: full() }))
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument()
  })
})

describe("when Open Library did not answer (details_loaded false)", () => {
  it("shows what it has, says more is unavailable, and offers a retry", () => {
    const { refetch } = show(state({ data: { ...listed, languages: [], all_subjects: [], links: {}, details_loaded: false } }))
    expect(screen.getByText("Pride and Prejudice")).toBeInTheDocument()
    expect(screen.getByText("Size").nextElementSibling).toHaveTextContent("2.0 MB")
    expect(screen.getByText(/More details unavailable right now/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(refetch).toHaveBeenCalled()
  })

  it("does not say it when the details loaded", () => {
    show(state({ data: full() }))
    expect(screen.queryByText(/More details unavailable/)).not.toBeInTheDocument()
  })
})

describe("errors", () => {
  it("a 404 means the book left the catalog: tell the page", () => {
    const { onGone } = show(state({ isError: true, error: new ApiError("Not Found", 404) }))
    expect(onGone).toHaveBeenCalled()
  })

  it("any other failure shows an error with a retry", () => {
    const { refetch, onGone } = show(state({ isError: true, error: new ApiError("bad gateway", 502) }))
    expect(screen.getByRole("alert")).toHaveTextContent("Open Library did not answer. Try again in a moment.")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(refetch).toHaveBeenCalled()
    expect(onGone).not.toHaveBeenCalled()
  })

  it("a server error says something went wrong", () => {
    show(state({ isError: true, error: new ApiError("boom", 500) }))
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Try again.")
  })
})

describe("adding", () => {
  it("adds this one book", () => {
    const { onAdd } = show(state({ data: full() }))
    fireEvent.click(screen.getByRole("button", { name: "Add to my library" }))
    expect(onAdd).toHaveBeenCalledWith(7)
  })

  it("is disabled and says so when the book is already in the library", () => {
    show(state({ data: full({ in_library: true }) }))
    expect(screen.getByRole("button", { name: "Already in your library" })).toBeDisabled()
  })

  it("is disabled and says Adding… while an add runs", () => {
    show(state({ data: full() }), { busy: true })
    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled()
  })

  it("can be added before the details arrive", () => {
    const { onAdd } = show(state({ isLoading: true }))
    fireEvent.click(screen.getByRole("button", { name: "Add to my library" }))
    expect(onAdd).toHaveBeenCalledWith(7)
  })
})

describe("closing", () => {
  it("closes with Escape", () => {
    const { onClose } = show(state({ data: full() }))
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})

describe("languageName", () => {
  it("turns three-letter codes into names, and leaves an unknown code alone", () => {
    expect(languageName("eng")).toBe("English")
    expect(languageName("fre")).toBe("French")
    expect(languageName("xyz")).toBe("xyz")
  })
})
