// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import StatsPage from "./page"
import { fetchAdmin } from "@/lib/api-client"
import { rangeFor } from "@/lib/subscriptions"

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
const books = { items: [{ olid: 123, title: "Sea of Rust", patrons: 4, opens: 30, last_read: null }], total: 45 }
const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const route = (s = stats) => fetchAdmin.mockImplementation((path) => ok(path.startsWith("stats/subscriptions/books") ? books : s))
const renderPage = () => render(<QueryClientProvider client={new QueryClient()}><StatsPage /></QueryClientProvider>)
const lastBooksCall = () => new URLSearchParams(fetchAdmin.mock.calls.map(([p]) => p).filter((p) => p.startsWith("stats/subscriptions/books")).at(-1).split("?")[1])

beforeEach(() => jest.clearAllMocks())

it("counts back from today for the period", () => {
  expect(rangeFor(7, new Date("2026-11-14T10:00:00Z"))).toEqual({ from: "2026-11-08", to: "2026-11-14" })
  expect(rangeFor(1, new Date("2026-11-14T10:00:00Z"))).toEqual({ from: "2026-11-14", to: "2026-11-14" })
})

it("shows the totals, each day, the devices and the books", async () => {
  route()
  renderPage()
  expect(await screen.findByText("42")).toBeInTheDocument()
  expect(screen.getByText("Opened in the last 15 min").nextSibling).toHaveTextContent("2")
  expect(screen.getByText("2026-11-13")).toBeInTheDocument()
  expect(screen.getByText("mobile")).toBeInTheDocument()
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
  fireEvent.change(screen.getByLabelText("Period"), { target: { value: "7" } })
  await waitFor(() => expect(lastBooksCall().get("from")).toBe(rangeFor(7).from))
})

it("says so when nothing was read in the period", async () => {
  route({ totals: { books_read: 0, patrons: 0, opens: 0, active_now: 0 }, by_day: [], devices: [] })
  renderPage()
  expect(await screen.findByText(/No reads in this period/)).toBeInTheDocument()
  expect(screen.queryByText("Per day")).not.toBeInTheDocument()
})

it("keeps the period picker when the stats fail to load", async () => {
  const { handleApiResponse } = jest.requireMock("@/lib/api-client")
  handleApiResponse.mockImplementation(() => Promise.reject(new Error("The range is too long.")))
  fetchAdmin.mockReturnValue(ok({}))
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StatsPage /></QueryClientProvider>)
  expect(await screen.findByText("The range is too long.")).toBeInTheDocument()
  expect(screen.getByLabelText("Period")).toBeInTheDocument()
  handleApiResponse.mockImplementation((res) => res.json())
})
