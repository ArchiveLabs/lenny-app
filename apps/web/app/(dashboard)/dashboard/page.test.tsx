// @ts-nocheck
import { render, screen, within } from "@testing-library/react"
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
  health: { database: "ok", storage: "ok", reader: "down", version: "0.7.0" },
}
const ghost = { site_url: "https://hydra.test", allowed_tier_ids: [], seen_tiers: [], snippet: "", webhook_url: "", webhook_secret: null, default_access_mode: "open" }
const stats = { totals: { books_read: 4, patrons: 9, opens: 55, active_now: 2 }, by_day: [], devices: [] }
const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const route = ({ s = summary, g = ghost } = {}) =>
  fetchAdmin.mockImplementation((path) => ok(path === "dashboard" ? s : path === "settings/ghost" ? g : stats))
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DashboardPage /></QueryClientProvider>)
const card = (title) => screen.getByText(title, { selector: "[data-slot=card-title]" }).closest("[data-slot=card]")

beforeEach(() => jest.clearAllMocks())

it("shows the library by access mode", async () => {
  route()
  renderPage()
  await screen.findByText("Library")
  const lib = within(card("Library"))
  expect(lib.getByText("120")).toBeInTheDocument()
  expect(lib.getByText("Subscription").nextSibling).toHaveTextContent("10")
  expect(lib.getByRole("link", { name: "Open the library" })).toHaveAttribute("href", "/library")
})

it("flags overdue loans and failed imports, and links to them", async () => {
  route()
  renderPage()
  await screen.findByText("Loans")
  expect(within(card("Loans")).getByText("7")).toBeInTheDocument()
  expect(within(card("Loans")).getByRole("link", { name: "Overdue" })).toHaveAttribute("href", "/loans?status=overdue")
  expect(within(card("Loans")).getByText("2")).toBeInTheDocument()
  expect(within(card("Imports")).getByText("1")).toBeInTheDocument()
})

it("says which services are up or down", async () => {
  route()
  renderPage()
  await screen.findByText("Health")
  const h = within(card("Health"))
  expect(h.getByText("Lenny 0.7.0")).toBeInTheDocument()
  expect(h.getAllByText("Up")).toHaveLength(2)
  expect(h.getByText("Reader").nextSibling).toHaveTextContent("Down")
})

it("says a part couldn't be read instead of showing zeros", async () => {
  route({ s: { ...summary, loans: null } })
  renderPage()
  await screen.findByText("Loans")
  expect(within(card("Loans")).getByText("Lenny couldn't read this right now.")).toBeInTheDocument()
})

it("shows Ghost members only when a Ghost site is connected", async () => {
  route()
  const { unmount } = renderPage()
  expect(await screen.findByText("Ghost members")).toBeInTheDocument()
  expect(await within(card("Ghost members")).findByText("55")).toBeInTheDocument()
  expect(within(card("Ghost members")).getByRole("link", { name: "See subscription stats" })).toHaveAttribute("href", "/stats")
  unmount()

  jest.clearAllMocks()
  route({ g: { ...ghost, site_url: null } })
  renderPage()
  await screen.findByText("Library")
  expect(screen.queryByText("Ghost members")).not.toBeInTheDocument()
  expect(fetchAdmin.mock.calls.some(([p]) => p.startsWith("stats/"))).toBe(false)
})

it("asks to update Lenny when the server has no dashboard", async () => {
  const { handleApiResponse } = jest.requireMock("@/lib/api-client")
  route()
  handleApiResponse.mockImplementationOnce(() => Promise.reject(new ApiError("Not found.", 404)))
  renderPage()
  expect(await screen.findByText(/doesn't have a dashboard yet/)).toBeInTheDocument()
})
