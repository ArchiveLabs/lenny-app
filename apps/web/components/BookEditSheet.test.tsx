// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { fetchAdmin } from "@/lib/api-client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BookEditSheet } from "./BookEditSheet"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock("@/lib/api-client", () => ({
  ...jest.requireActual("@/lib/api-client"),
  fetchAdmin: jest.fn(() => new Promise(() => {})), // the loan limits are not what this tests
}))
const linkField = jest.fn()
const ghost = { data: { site_url: "https://hydra.test", enabled: true }, isLoading: false }
jest.mock("@/hooks/use-ghost-settings", () => ({ useGhostSettings: jest.fn(() => ghost) }))
jest.mock("@/lib/library/share", () => ({ copyText: jest.fn() }))
jest.mock("@/components/library/LinkField", () => ({ LinkField: (p) => (linkField(p), <div>share link for {p.olid}</div>) }))
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

it("shows the share link", () => {
  open()
  expect(screen.getByText("share link for OL28933309M")).toBeInTheDocument()
  expect(linkField).toHaveBeenLastCalledWith({ olid: "OL28933309M" })
})

const openBook = (lenny) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BookEditSheet book={{ ...book, lenny: { ...book.lenny, ...lenny } }}><button>open</button></BookEditSheet>
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByText("open"))
}

describe("by access mode", () => {
  it("warns on the Read button while Ghost is turned off", () => {
    ghost.data = { site_url: "https://hydra.test", enabled: false }
    openBook({ access_mode: "subscription" })
    expect(screen.getByText(/Ghost is turned off, so members can't read it/)).toBeInTheDocument()
    ghost.data = { site_url: "https://hydra.test", enabled: true }
  })

  it("marks a subscription book Members only, with no copies and no loan duration", () => {
    openBook({ access_mode: "subscription", available_copies: 0 })
    expect(screen.getByText("Members only")).toBeInTheDocument()
    expect(screen.queryByText(/cop(y|ies) available/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Loan duration (days)")).not.toBeInTheDocument()
  })

  it("puts the Ghost Read button in the Access card, saying it once who can read", () => {
    openBook({ access_mode: "subscription" })
    expect(screen.getByLabelText("Read button: HTML card code")).toHaveValue('<button data-lenny-book="OL28933309M">Read</button>')
    expect(screen.getByRole("button", { name: "Copy HTML card code" })).toBeInTheDocument()
    // Ghost's Button card takes only a link: one on the Ghost site itself, which the snippet catches.
    expect(screen.getByLabelText("Read button: Button card link")).toHaveValue("https://hydra.test/#lenny-book=OL28933309M")
    expect(screen.getByRole("button", { name: "Copy Button card link" })).toBeInTheDocument()
    expect(screen.getAllByText(/Only paid members of your Ghost site/)).toHaveLength(1)
  })

  it("asks to connect Ghost first when no Ghost site is saved", () => {
    ghost.data = { site_url: null }
    openBook({ access_mode: "subscription" })
    expect(screen.getByText("Connect your Ghost site first")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Ghost settings" })).toHaveAttribute("href", "/settings/ghost")
    expect(screen.queryByLabelText("Read button: HTML card code")).not.toBeInTheDocument()
    ghost.data = { site_url: "https://hydra.test", enabled: true }
  })

  it("marks an open book Open access, with no Read button and no loan duration", () => {
    openBook({})
    expect(screen.getByText("Open access")).toBeInTheDocument()
    expect(screen.queryByLabelText("Read button: HTML card code")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Loan duration (days)")).not.toBeInTheDocument()
  })

  it("shows the loan duration only for a borrowable book", () => {
    openBook({ encrypted: true })
    expect(screen.getByLabelText("Loan duration (days)")).toBeInTheDocument()
  })
})

it("links the access modes to the manual, in a new tab", () => {
  open()
  const link = screen.getByRole("link", { name: "Learn more about access modes" })
  expect(link).toHaveAttribute("href", "https://github.com/ArchiveLabs/lenny/blob/main/docs/subscriptions.md")
  expect(link).toHaveAttribute("target", "_blank")
  expect(link).toHaveAttribute("rel", "noopener noreferrer")
})

it("reads an older server's encrypted flag as borrowable", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BookEditSheet book={{ ...book, lenny: { ...book.lenny, encrypted: true } }}><button>open</button></BookEditSheet>
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByText("open"))
  expect(screen.getByLabelText("Access")).toHaveValue("borrowable")
})

it("saves the chosen access mode", async () => {
  open()
  fireEvent.change(screen.getByLabelText("Access"), { target: { value: "subscription" } })
  expect(screen.getByText("Only paid members of your Ghost site can read it.")).toBeInTheDocument()
  expect(screen.getByText("Save changes first, or the button won't open this book.")).toBeInTheDocument()
  fireEvent.click(screen.getByText("Save changes"))
  await waitFor(() => expect(fetchAdmin).toHaveBeenCalledWith("items/OL28933309M", expect.objectContaining({ method: "PATCH" })))
  const call = fetchAdmin.mock.calls.find(([path]) => path === "items/OL28933309M")
  expect(JSON.parse(call[1].body)).toEqual({ access_mode: "subscription", loan_duration_days: null })
})

describe("copies in the sheet", () => {
  // Copies only show for a borrowable book.
  const withCopies = (n) => ({ ...book, lenny: { ...book.lenny, encrypted: true, available_copies: n } })
  const openWith = (b) => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BookEditSheet book={b}><button>open</button></BookEditSheet>
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByText("open"))
  }

  it("says how many copies are available", () => {
    openWith(withCopies(3))
    expect(screen.getByText("3 copies available")).toBeInTheDocument()
  })

  it("uses the singular for one", () => {
    openWith(withCopies(1))
    expect(screen.getByText("1 copy available")).toBeInTheDocument()
  })

  it("says zero copies when there are none", () => {
    openWith(withCopies(0))
    expect(screen.getByText("0 copies available")).toBeInTheDocument()
  })

  it("shows nothing, not undefined, when the record has no count", () => {
    openWith(withCopies(undefined))
    expect(screen.queryByText(/cop(y|ies) available/)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/undefined/)
  })
})

describe("active loans when the book stops being borrowable", () => {
  const { toast } = jest.requireMock("sonner")
  const res = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
  const withLoans = (n, patch = { openlibrary_edition: 28933309, loans_returned: n }) =>
    fetchAdmin.mockClear().mockImplementation((path, opts) =>
      path.startsWith("loans?") ? res({ items: [], total: n, limit: 1, offset: 0 })
        : opts?.method === "PATCH" ? res(patch)
        : new Promise(() => {}),
    )
  afterEach(() => fetchAdmin.mockImplementation(() => new Promise(() => {})))

  it("warns, asks first, returns the loans and says how many", async () => {
    withLoans(2)
    openBook({ encrypted: true })
    expect(fetchAdmin.mock.calls.some(([p]) => p.startsWith("loans?"))).toBe(false) // still borrowable: nothing to ask
    fireEvent.change(screen.getByLabelText("Access"), { target: { value: "subscription" } })
    expect(await screen.findByText("2 patrons have this book on loan")).toBeInTheDocument()
    const q = new URLSearchParams(fetchAdmin.mock.calls.find(([p]) => p.startsWith("loans?"))[0].split("?")[1])
    expect([q.get("status"), q.get("item")]).toEqual(["active", "OL28933309M"])

    fireEvent.click(screen.getByText("Save changes"))
    expect(screen.getByText("Return 2 loans?")).toBeInTheDocument()
    expect(fetchAdmin.mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(false)
    fireEvent.click(screen.getByText("Return loans and save"))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Book updated. 2 loans returned."))
  })

  it("flags loans left on a book that is already members only", async () => {
    withLoans(1)
    openBook({ access_mode: "subscription" })
    expect(await screen.findByText("1 patron has this book on loan")).toBeInTheDocument()
  })

  it("saves straight away when nobody has it on loan", async () => {
    withLoans(0)
    openBook({ access_mode: "subscription" })
    await waitFor(() => expect(fetchAdmin.mock.calls.some(([p]) => p.startsWith("loans?"))).toBe(true))
    fireEvent.click(screen.getByText("Save changes"))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Book updated"))
    expect(screen.queryByText(/Return \d+ loans?\?/)).not.toBeInTheDocument()
  })
})
