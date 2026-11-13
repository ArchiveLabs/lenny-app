// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemberPasses } from "./MemberPasses"
import { fetchAdmin } from "@/lib/api-client"
import { timeLeft } from "@/lib/subscriptions"
import { toast } from "sonner"

jest.mock("@/lib/api-client", () => ({
  fetchAdmin: jest.fn(),
  handleApiResponse: jest.fn((res) => res.json()),
}))
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const inHours = (h) => new Date(Date.now() + h * 3_600_000 + 60_000).toISOString()
const passes = {
  items: [
    { id: 1, member: "a1b2c3d4", provider: "ghost", tier_ids: ["tier-gold"], expires_at: inHours(5), renewed_at: null },
    { id: 2, member: "ffee0011", provider: "ghost", tier_ids: [], expires_at: inHours(23), renewed_at: null },
  ],
  total: 2,
}
const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const renderIt = () =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemberPasses leaseHours={24} header={<h2>Active Loans</h2>} /></QueryClientProvider>)

beforeEach(() => jest.clearAllMocks())

it("says how long is left on a pass", () => {
  const now = Date.parse("2026-11-14T10:00:00Z")
  expect(timeLeft("2026-11-14T15:30:00Z", now)).toBe("in 5 h")
  expect(timeLeft("2026-11-14T10:40:00Z", now)).toBe("in 40 min")
  expect(timeLeft("2026-11-14T10:00:30Z", now)).toBe("now")
  expect(timeLeft("not a date", now)).toBe("now")
})

it("lists each pass by its short anonymous id, tier and time left, and explains passes", async () => {
  fetchAdmin.mockReturnValue(ok(passes))
  renderIt()
  expect(await screen.findByText("a1b2c3d4")).toBeInTheDocument()
  expect(screen.getByText("tier-gold")).toBeInTheDocument()
  expect(screen.getByText("Paid member")).toBeInTheDocument()
  expect(screen.getByText("in 5 h")).toBeInTheDocument()
  expect(screen.getByText(/24-hour pass/)).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "See what they read" })).toHaveAttribute("href", "/stats")
  expect(fetchAdmin).toHaveBeenCalledWith("subscriptions?page=1&page_size=20")
})

it("ends a pass only after confirming", async () => {
  fetchAdmin.mockImplementation((path, opts) => ok(opts?.method === "DELETE" ? {} : passes))
  renderIt()
  await screen.findByText("a1b2c3d4")
  fireEvent.click(screen.getAllByRole("button", { name: "End pass" })[0])
  expect(screen.getByText("End the pass for member a1b2c3d4?")).toBeInTheDocument()
  expect(fetchAdmin.mock.calls.some(([, o]) => o?.method === "DELETE")).toBe(false)
  fireEvent.click(screen.getAllByRole("button", { name: "End pass" }).at(-1))
  await waitFor(() => expect(fetchAdmin).toHaveBeenCalledWith("subscriptions/1", { method: "DELETE" }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pass ended for member a1b2c3d4."))
})

it("says so when no member has a pass", async () => {
  fetchAdmin.mockReturnValue(ok({ items: [], total: 0 }))
  renderIt()
  expect(await screen.findByText("No member has an active pass")).toBeInTheDocument()
})
