// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { RowList } from "./RowList"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))

const row = (id, over = {}) => ({
  id, path: `L/b${id}.epub`, size: 1, mtime: 1, state: "matched", decision: "auto", skipped: false, staged: true, encrypted: false,
  auto_picked: true, confidence: 100, candidates_count: 0, title: `Book ${id}`, match_title: `Book ${id}`, ...over,
})
const handlers = () => ({
  onOpen: jest.fn(), onDetails: jest.fn(), onRemove: jest.fn(), onToggleEncrypted: jest.fn(), onSelect: jest.fn(),
  selected: new Map(), needsFile: () => false, upload: () => undefined, onRetryUpload: jest.fn(),
})

it("lists every row of the page in order", () => {
  render(<RowList rows={[row(1), row(2), row(3)]} {...handlers()} />)
  expect(screen.getAllByRole("listitem")).toHaveLength(3)
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    expect.stringContaining("Book 1"), expect.stringContaining("Book 2"), expect.stringContaining("Book 3"),
  ])
})

it("renders a whole page of 50 rows, not a window of them", () => {
  render(<RowList rows={Array.from({ length: 50 }, (_, i) => row(i + 1))} {...handlers()} />)
  expect(screen.getAllByRole("listitem")).toHaveLength(50)
})

it("does not scroll inside the page or position rows absolutely, so a tall row cannot overlap the next", () => {
  render(<RowList rows={[row(1), row(2)]} {...handlers()} />)
  const list = screen.getByRole("list", { name: "Books" })
  expect(list.className).not.toMatch(/overflow-auto|overflow-y|h-\[/)
  for (const item of screen.getAllByRole("listitem")) expect(item.getAttribute("style") ?? "").not.toContain("absolute")
})

it("separates the rows with a divider rather than a border on every row", () => {
  render(<RowList rows={[row(1), row(2)]} {...handlers()} />)
  expect(screen.getByRole("list", { name: "Books" }).className).toContain("divide-y")
})

it("passes each row's handlers and selection through", () => {
  const h = handlers()
  h.selected = new Map([[2, row(2)]])
  render(<RowList rows={[row(1), row(2)]} {...h} />)
  fireEvent.click(screen.getByRole("button", { name: "Show details for Book 1" }))
  expect(h.onDetails).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  expect(screen.getByRole("checkbox", { name: "Select Book 2" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Select Book 1" })).not.toBeChecked()
})

it("lets a row with a long title and a wrapped line simply be taller", () => {
  render(<RowList rows={[row(1, { match_title: "How to Read a Book: The Classic Guide to Intelligent Reading ".repeat(3) }), row(2)]} {...handlers()} />)
  expect(screen.getAllByRole("listitem")).toHaveLength(2)
})
