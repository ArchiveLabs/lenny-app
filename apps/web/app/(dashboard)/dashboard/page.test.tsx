// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import DashboardPage from "./page"
import { fetchAdmin } from "@/lib/api-client"
import { ApiError } from "@/types/api"

jest.mock("@/lib/api-client", () => ({
  fetchAdmin: jest.fn(),
  handleApiResponse: jest.fn((res) => res.json()),
}))
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))

const summary = {
  books: { total: 120, open: 80, borrowable: 30, subscription: 10 },
  loans: { active: 7, overdue: 2, started_30d: 19 },
  imports: { pending: 3, failed: 1 },
  health: { database: "ok", storage: "ok", reader: "down", version: "0.10.0" },
}
const ghost = { site_url: "https://hydra.test", allowed_tier_ids: [], seen_tiers: [], snippet: "", webhook_url: "", webhook_secret: null, enabled: true }
const stats = { totals: { books_read: 4, patrons: 9, opens: 55, active_now: 2 }, by_day: [], devices: [] }
const loanStats = { by_day: [{ date: "2026-11-13", started: 4, returned: 1 }] }
const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const noLoans = { items: [], total: 0, limit: 5, offset: 0 }
const route = ({ s = summary, g = ghost, l = loanStats } = {}) =>
  fetchAdmin.mockImplementation((path) =>
    ok(path === "dashboard" ? s : path === "settings/ghost" ? g : path.startsWith("stats/loans") ? l : path.startsWith("loans?") ? noLoans : stats),
  )
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DashboardPage /></QueryClientProvider>)
// A number's tile is found by its label.
const card = (label) => screen.getAllByText(label, { selector: "p" })[0].closest(".rounded-2xl")

beforeEach(() => jest.clearAllMocks())

it("shows the books and their access modes, and links to the library", async () => {
  route()
  renderPage()
  await screen.findByText("Books")
  const c = card("Books")
  expect(c).toHaveTextContent("120")
  expect(c).toHaveTextContent("30 borrowable")
  expect(c.querySelector("a")).toHaveAttribute("href", "/library")
  expect(screen.getByRole("img", { name: "80 open, 30 borrowable, 10 subscription" })).toBeInTheDocument()
  expect(screen.getByText("Subscription").closest("li")).toHaveTextContent("10")
})

it("shows loans on loan now and overdue, each linking to the loans behind it", async () => {
  route()
  renderPage()
  await screen.findByText("On loan now")
  expect(card("On loan now")).toHaveTextContent("7")
  expect(card("Overdue")).toHaveTextContent("2")
  expect(card("Overdue")).toHaveTextContent("Needs a look")
  expect(card("Overdue").querySelector("a")).toHaveAttribute("href", "/loans?status=overdue")
  expect(card("Imports")).toHaveTextContent("1 failed")
})

it("compares this week's loans with the week before", async () => {
  const today = new Date().toISOString().slice(0, 10)
  route({ l: { by_day: [{ date: today, started: 3, returned: 0 }] } })
  renderPage()
  await screen.findByText("On loan now")
  await waitFor(() => expect(card("On loan now")).toHaveTextContent("+3"))
})

it("says which services run, and raises an alert for one that is down", async () => {
  route()
  renderPage()
  expect(await screen.findByText("Some services are down")).toBeInTheDocument()
  expect(screen.getByText("Reader not responding")).toBeInTheDocument()
  expect(screen.getByText("Reader").closest("div")).toHaveTextContent("ReaderDown")
  expect(screen.getByText("Version").closest("div")).toHaveTextContent("0.10.0")
})

it("stays quiet when everything is fine", async () => {
  route({ s: { ...summary, imports: { pending: 0, failed: 0 }, health: { ...summary.health, reader: "ok" } } })
  renderPage()
  expect(await screen.findByText("All services running")).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(card("Imports")).toHaveTextContent("Nothing failed")
})

it("shows a dash, not zero, for a part the server couldn't read", async () => {
  route({ s: { ...summary, loans: null } })
  renderPage()
  await screen.findByText("On loan now")
  expect(card("On loan now")).toHaveTextContent("—")
})

it("charts loans started per day, and asks again for another period", async () => {
  route()
  renderPage()
  expect(await screen.findByText("Busiest week")).toBeInTheDocument()
  expect(screen.getByText("Per week")).toBeInTheDocument()
  const lastLoans = () => new URLSearchParams(fetchAdmin.mock.calls.map(([p]) => p).filter((p) => p.startsWith("stats/loans")).at(-1).split("?")[1])
  fireEvent.click(screen.getByRole("radio", { name: "1W" }))
  await waitFor(() => expect(Date.parse(lastLoans().get("to")) - Date.parse(lastLoans().get("from"))).toBe(6 * 86_400_000))
})

it("hides the loans chart on a server without loan stats", async () => {
  const { handleApiResponse } = jest.requireMock("@/lib/api-client")
  route()
  handleApiResponse.mockImplementation(async (res) => {
    const body = await res.json()
    if (body === loanStats) throw new ApiError("Not found.", 404)
    return body
  })
  renderPage()
  await screen.findByText("Books")
  await waitFor(() => expect(fetchAdmin.mock.calls.some(([p]) => p.startsWith("stats/loans"))).toBe(true))
  expect(screen.queryByText("Busiest week")).not.toBeInTheDocument()
  handleApiResponse.mockImplementation((res) => res.json())
})

it("shows Ghost members only when a Ghost site is connected", async () => {
  route()
  const { unmount } = renderPage()
  expect(await screen.findByText("Ghost members")).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText("Opens").closest("div")).toHaveTextContent("55"))
  expect(screen.getByRole("link", { name: "Subscription stats" })).toHaveAttribute("href", "/stats")
  unmount()

  jest.clearAllMocks()
  route({ g: { ...ghost, site_url: null } })
  renderPage()
  await screen.findByText("Books")
  expect(screen.queryByText("Ghost members")).not.toBeInTheDocument()
  expect(fetchAdmin.mock.calls.some(([p]) => p.startsWith("stats/subscriptions"))).toBe(false)
})

it("asks to update Lenny when the server has no dashboard", async () => {
  const { handleApiResponse } = jest.requireMock("@/lib/api-client")
  route()
  handleApiResponse.mockImplementationOnce(() => Promise.reject(new ApiError("Not found.", 404)))
  renderPage()
  expect(await screen.findByText(/doesn't have a dashboard yet/)).toBeInTheDocument()
})

it("lists the latest loans, newest first, with their status", async () => {
  const { fetchAdmin: fa } = jest.requireMock("@/lib/api-client")
  route()
  const recent = { items: [{ id: 9, user_identifier: "c496ce1a42c6ffff", book_title: "Sea of Rust", edition_key: "OL1M", borrowed_at: null, due_at: null, status: "overdue" }], total: 1, limit: 5, offset: 0 }
  const base = fa.getMockImplementation()
  fa.mockImplementation((path) => (path.startsWith("loans?") ? ok(recent) : base(path)))
  renderPage()
  expect(await screen.findByText("Sea of Rust")).toBeInTheDocument()
  expect(screen.getByText("Sea of Rust").closest("li")).toHaveTextContent("Overdue")
  expect(screen.getByText("Patron c496ce1a42c6")).toBeInTheDocument()
  const q = new URLSearchParams(fa.mock.calls.find(([p]) => p.startsWith("loans?"))[0].split("?")[1])
  expect([q.get("limit"), q.get("sort"), q.get("order")]).toEqual(["5", "borrowed_at", "desc"])
})
