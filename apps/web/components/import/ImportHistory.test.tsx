// @ts-nocheck
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ImportHistory, dayLabel, groupByDay, timeOf } from "./ImportHistory"
import { importApi } from "@/lib/import/api"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))
jest.mock("@/lib/import/api", () => ({ importApi: { rows: jest.fn(), patchRow: jest.fn() } }))

// Local times, so the tests do not depend on the machine's time zone.
const at = (y, mo, d, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString()
const NOW = new Date(2026, 9, 11, 18, 40) // Oct 11 2026, 6:40 PM
const row = (id, over = {}) => ({
  id, path: `L/b${id}.epub`, size: 1, mtime: 1, state: "imported", decision: "auto", staged: false, encrypted: false,
  auto_picked: true, candidates_count: 0, title: `Book ${id}`, author: `Author ${id}`, match_title: `Book ${id}`, match_author: `Author ${id}`, olid: 100 + id, imported_at: at(2026, 10, 11, 18, 36), ...over,
})
const show = (rows, extra = {}) => {
  importApi.rows.mockResolvedValue({ rows, next_cursor: null, total: rows.length, ...extra })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ImportHistory batchId={7} total={rows.length} retentionDays={30} now={NOW} />
    </QueryClientProvider>,
  )
}

beforeEach(() => importApi.rows.mockReset())

describe("dayLabel", () => {
  it("says Today and Yesterday", () => {
    expect(dayLabel(at(2026, 10, 11, 1), NOW)).toBe("Today")
    expect(dayLabel(at(2026, 10, 10, 23), NOW)).toBe("Yesterday")
  })
  it("gives a date for older days, with the year only when it is not this year", () => {
    expect(dayLabel(at(2026, 10, 3), NOW)).toBe("Oct 3")
    expect(dayLabel(at(2025, 12, 24), NOW)).toBe("Dec 24, 2025")
  })
  it("says Earlier when there is no usable time", () => {
    expect(dayLabel(null, NOW)).toBe("Earlier")
    expect(dayLabel("not a date", NOW)).toBe("Earlier")
  })
  it("handles yesterday across a month end", () => {
    expect(dayLabel(at(2026, 9, 30, 10), new Date(2026, 9, 1, 9))).toBe("Yesterday")
  })
})

it("formats the time of day", () => {
  expect(timeOf(at(2026, 10, 11, 18, 36))).toBe("6:36 PM")
  expect(timeOf(null)).toBe("")
})

it("groups rows into runs of the same day, keeping their order", () => {
  const rows = [row(1), row(2), row(3, { imported_at: at(2026, 10, 10) }), row(4, { imported_at: null })]
  expect(groupByDay(rows, NOW).map((g) => [g.label, g.rows.map((r) => r.id)])).toEqual([
    ["Today", [1, 2]],
    ["Yesterday", [3]],
    ["Earlier", [4]],
  ])
})

describe("the history table", () => {
  it("asks for imported books, newest first, one page at a time", async () => {
    show([row(1)])
    await screen.findByText("Book 1")
    expect(importApi.rows).toHaveBeenCalledWith(7, { state: "imported", order: "imported_at_desc", offset: 0, limit: 50 })
  })

  it("lists each book with its Open Library id and the time it was imported", async () => {
    show([row(1)])
    await screen.findByText("Book 1")
    expect(screen.getByText("Author 1")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /OL101M/ })).toHaveAttribute("href", "https://openlibrary.org/books/OL101M")
    expect(screen.getByText("6:36 PM")).toBeInTheDocument()
  })

  it("separates the days with a heading and a count", async () => {
    show([row(1), row(2), row(3, { imported_at: at(2026, 10, 10, 9, 5) })])
    expect(await screen.findByText("Today · 2 books")).toBeInTheDocument()
    expect(screen.getByText("Yesterday · 1 books")).toBeInTheDocument()
  })

  it("says how many are imported and how long history is kept", async () => {
    show([row(1)])
    expect(await screen.findByText("1 imported. History is kept for 30 days.")).toBeInTheDocument()
  })

  it("links to the Library", async () => {
    show([row(1)])
    expect(await screen.findByRole("link", { name: "View in Library" })).toHaveAttribute("href", "/library")
  })

  it("says nothing is imported yet, and for how long history is kept", async () => {
    show([])
    expect(await screen.findByText("Nothing imported yet")).toBeInTheDocument()
    expect(screen.getByText("Books you import show up here for 30 days.")).toBeInTheDocument()
  })

  it("pages with the server's total", async () => {
    importApi.rows.mockResolvedValue({ rows: [row(1)], next_cursor: null, total: 120 })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ImportHistory batchId={7} total={120} retentionDays={30} now={NOW} />
      </QueryClientProvider>,
    )
    await screen.findByText("Book 1")
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }))
    await waitFor(() => expect(importApi.rows).toHaveBeenLastCalledWith(7, expect.objectContaining({ offset: 50, limit: 50 })))
  })

  it("opens a read-only details panel from the arrow", async () => {
    show([row(1)])
    fireEvent.click(await screen.findByRole("button", { name: "Show details for Book 1" }))
    expect(await screen.findByText("Compare")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Change edition|Choose edition/ })).not.toBeInTheDocument()
  })

  it("says so and offers a retry when the history cannot be loaded", async () => {
    importApi.rows.mockRejectedValueOnce(new Error("down")).mockResolvedValue({ rows: [row(1)], next_cursor: null, total: 1 })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ImportHistory batchId={7} total={1} retentionDays={30} now={NOW} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText("Could not load the history.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await screen.findByText("Book 1")
  })
})

describe("old rows with no matched title", () => {
  it("asks the server to fill them in once, and shows the OL id meanwhile", async () => {
    importApi.patchRow.mockResolvedValue({})
    show([row(1, { match_title: null, match_author: null })])
    await screen.findByText("1 imported. History is kept for 30 days.")
    await waitFor(() => expect(importApi.patchRow).toHaveBeenCalledWith(7, 1, { olid: 101 }))
    expect(importApi.patchRow).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("Book 1")).not.toBeInTheDocument()
  })
})
