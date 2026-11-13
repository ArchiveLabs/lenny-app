// @ts-nocheck
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
const ghost = { site_url: "https://hydra.test", allowed_tier_ids: [], seen_tiers: [], snippet: "", webhook_url: "", webhook_secret: null, default_access_mode: "open" }
const stats = { totals: { books_read: 4, patrons: 9, opens: 55, active_now: 2 }, by_day: [], devices: [] }
const loanStats = { by_day: [{ date: "2026-11-13", started: 4, returned: 1 }] }
const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const route = ({ s = summary, g = ghost, l = loanStats } = {}) =>
  fetchAdmin.mockImplementation((path) =>
    ok(path === "dashboard" ? s : path === "settings/ghost" ? g : path.startsWith("stats/loans") ? l : stats),
  )
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DashboardPage /></QueryClientProvider>)
// A card is found by its label (the shadcn card description).
const card = (label) => screen.getAllByText(label).map((el) => el.closest("[data-slot=card]")).find(Boolean)

beforeEach(() => jest.clearAllMocks())

it("shows the books with their access modes", async () => {
  route()
  renderPage()
  await screen.findByText("Books")
  const c = within(card("Books"))
  expect(c.getByText("120")).toBeInTheDocument()
  expect(c.getByText("80 open · 30 borrowable · 10 subscription")).toBeInTheDocument()
  expect(c.getByRole("link", { name: "Open the library" })).toHaveAttribute("href", "/library")
})

it("flags overdue loans and failed imports, and links to them", async () => {
  route()
  renderPage()
  await screen.findByText("Active loans")
  const loans = within(card("Active loans"))
  expect(loans.getByText("7")).toBeInTheDocument()
  expect(loans.getByText("2 overdue")).toBeInTheDocument()
  expect(loans.getByRole("link", { name: "See overdue loans" })).toHaveAttribute("href", "/loans?status=overdue")
  expect(within(card("Imports in progress")).getByText("1 failed")).toBeInTheDocument()
})

it("names the services that are down", async () => {
  route()
  renderPage()
  await screen.findByText("Health")
  const h = within(card("Health"))
  expect(h.getByText("1 down")).toBeInTheDocument()
  expect(h.getByText("Down: Reader")).toBeInTheDocument()
  expect(h.getByText("Lenny 0.10.0")).toBeInTheDocument()
})

it("shows a dash, not zero, for a part the server couldn't read", async () => {
  route({ s: { ...summary, loans: null } })
  renderPage()
  await screen.findByText("Active loans")
  expect(within(card("Active loans")).getByText("—")).toBeInTheDocument()
})

it("charts loans started per day, and asks again for another period", async () => {
  route()
  renderPage()
  expect(await screen.findByText("Loans started")).toBeInTheDocument()
  const lastLoans = () => new URLSearchParams(fetchAdmin.mock.calls.map(([p]) => p).filter((p) => p.startsWith("stats/loans")).at(-1).split("?")[1])
  fireEvent.click(screen.getByRole("radio", { name: "Last 7 days" }))
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
  expect(screen.queryByText("Loans started")).not.toBeInTheDocument()
  handleApiResponse.mockImplementation((res) => res.json())
})

it("shows Ghost members only when a Ghost site is connected", async () => {
  route()
  const { unmount } = renderPage()
  expect(await screen.findByText("Ghost members")).toBeInTheDocument()
  expect(await within(card("Reading now")).findByText("Live")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "See subscription stats" })).toHaveAttribute("href", "/stats")
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
