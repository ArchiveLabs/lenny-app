// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import StatsPage from "./page"
import { fetchAdmin } from "@/lib/api-client"
import { dayLabel, fillDays, rangeFor } from "@/lib/subscriptions"

jest.mock("@/lib/api-client", () => ({
  fetchAdmin: jest.fn(),
  handleApiResponse: jest.fn((res) => res.json()),
}))
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))

const stats = {
  totals: { books_read: 3, patrons: 5, opens: 42, active_now: 2 },
  by_day: [{ date: "2026-11-13", books_read: 2, patrons: 4, opens: 30 }, { date: "2026-11-14", books_read: 1, patrons: 1, opens: 12 }],
  devices: [{ device_class: "mobile", patrons: 3, opens: 20 }],
}
const books = { items: [{ olid: "OL123M", title: "Sea of Rust", patrons: 4, opens: 30, last_read: null }], total: 45 }
const ghost = { site_url: "https://hydra.test", allowed_tier_ids: [], seen_tiers: [], snippet: "", webhook_url: "", webhook_secret: null, default_access_mode: "open" }
const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const route = ({ s = stats, g = ghost } = {}) =>
  fetchAdmin.mockImplementation((path) =>
    ok(path === "settings/ghost" ? g : path.startsWith("stats/subscriptions/books") ? books : s),
  )
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StatsPage /></QueryClientProvider>)
const lastBooksCall = () => new URLSearchParams(fetchAdmin.mock.calls.map(([p]) => p).filter((p) => p.startsWith("stats/subscriptions/books")).at(-1).split("?")[1])

beforeEach(() => jest.clearAllMocks())

describe("dates", () => {
  it("counts back from today for the period", () => {
    expect(rangeFor(7, new Date("2026-11-14T10:00:00Z"))).toEqual({ from: "2026-11-08", to: "2026-11-14" })
    expect(rangeFor(1, new Date("2026-11-14T10:00:00Z"))).toEqual({ from: "2026-11-14", to: "2026-11-14" })
  })

  it("fills the days the server left out with zeros, so the chart has no gaps", () => {
    const days = fillDays([{ date: "2026-11-13", books_read: 1, patrons: 1, opens: 5 }], "2026-11-12", "2026-11-14", { books_read: 0, patrons: 0, opens: 0 })
    expect(days.map((d) => [d.date, d.opens])).toEqual([["2026-11-12", 0], ["2026-11-13", 5], ["2026-11-14", 0]])
  })

  it("labels a day as the server wrote it, whatever the local time zone", () => {
    expect(dayLabel("2026-11-01")).toBe("Nov 1")
  })
})

it("says the page is for Ghost and asks to connect a site when none is", async () => {
  route({ g: { ...ghost, site_url: null } })
  renderPage()
  expect(await screen.findByText("Connect a Ghost site to see these stats")).toBeInTheDocument()
  expect(screen.getByText("Ghost")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Set up Ghost" })).toHaveAttribute("href", "/settings/ghost")
  expect(fetchAdmin.mock.calls.some(([p]) => p.startsWith("stats/"))).toBe(false)
  expect(screen.queryByText("Opens per day")).not.toBeInTheDocument()
})

it("treats a server without Ghost settings like an unconnected one", async () => {
  const { handleApiResponse } = jest.requireMock("@/lib/api-client")
  fetchAdmin.mockReturnValue(ok({}))
  handleApiResponse.mockImplementationOnce(() => Promise.reject(Object.assign(new Error("Not found."), { status: 404 })))
  renderPage()
  expect(await screen.findByText("Connect a Ghost site to see these stats")).toBeInTheDocument()
})

it("shows the totals, the opens chart, the devices and the books", async () => {
  route()
  renderPage()
  const card = (label) => screen.getAllByText(label).map((el) => el.closest("[data-slot=card]")).find(Boolean)
  expect(await screen.findByText("Opens per day")).toBeInTheDocument()
  expect(card("Books read")).toHaveTextContent("3")
  expect(card("Different members who read")).toHaveTextContent("5")
  expect(card("Reading now")).toHaveTextContent("Live")
  expect(screen.getByText(/How members of hydra.test read/)).toBeInTheDocument()
  expect(screen.getByText("Nov 13")).toBeInTheDocument()
  expect(screen.getByText("Phone")).toBeInTheDocument()
  expect(screen.getByText("100%")).toBeInTheDocument()
  expect(await screen.findByText("Sea of Rust")).toBeInTheDocument()
  expect(screen.getByText("Showing 1–20 of 45")).toBeInTheDocument()
})

it("asks the server again for a new period, sort or page", async () => {
  route()
  renderPage()
  await screen.findByText("Sea of Rust")
  expect(lastBooksCall().get("sort")).toBe("opens")
  expect(lastBooksCall().get("page")).toBe("1")
  fireEvent.click(screen.getByRole("button", { name: "Page 2" }))
  await waitFor(() => expect(lastBooksCall().get("page")).toBe("2"))
  fireEvent.change(screen.getByLabelText("Sort books by"), { target: { value: "patrons" } })
  await waitFor(() => expect(lastBooksCall().get("sort")).toBe("patrons"))
  expect(lastBooksCall().get("page")).toBe("1")
  fireEvent.click(screen.getByRole("radio", { name: "Last 7 days" }))
  await waitFor(() => expect(lastBooksCall().get("from")).toBe(rangeFor(7).from))
})

it("says so when nothing was read in the period, and skips the books", async () => {
  route({ s: { totals: { books_read: 0, patrons: 0, opens: 0, active_now: 0 }, by_day: [], devices: [] } })
  renderPage()
  expect(await screen.findByText("No reads in this period")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Learn how to add Read buttons to your Ghost posts" })).toHaveAttribute("target", "_blank")
  expect(screen.getByText("Opens per day")).toBeInTheDocument() // kept, so the period can still change
  expect(fetchAdmin.mock.calls.some(([p]) => p.startsWith("stats/subscriptions/books"))).toBe(false)
})

it("says why when the stats fail to load", async () => {
  const { handleApiResponse } = jest.requireMock("@/lib/api-client")
  route()
  handleApiResponse.mockImplementation(async (res) => {
    const body = await res.json()
    if (body === ghost) return body
    throw new Error("The range is too long.")
  })
  renderPage()
  expect(await screen.findByText("The range is too long.")).toBeInTheDocument()
  handleApiResponse.mockImplementation((res) => res.json())
})
