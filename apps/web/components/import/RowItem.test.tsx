// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { RowItem } from "./RowItem"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }) }))

const row = (over = {}) => ({
  id: 1, path: "L/a.epub", size: 1, mtime: 1, state: "matched", decision: "auto", skipped: false, staged: false,
  encrypted: false, auto_picked: false, candidates_count: 0, title: "Dune", ...over,
})
const show = (r, needsFile = false) =>
  render(<RowItem row={r} needsFile={needsFile} onOpen={jest.fn()} onRemove={jest.fn()} onToggleEncrypted={jest.fn()} onSelect={jest.fn()} selected={false} />)

it("shows Uploaded for a matched row whose file is on the server", () => {
  show(row({ staged: true }))
  expect(screen.getByText("Uploaded")).toBeInTheDocument()
})

it("does not show Uploaded for an unsent or skipped row", () => {
  show(row())
  expect(screen.queryByText("Uploaded")).not.toBeInTheDocument()
})

it("asks for the file again only when it is neither staged nor in memory", () => {
  const { rerender } = show(row(), true)
  expect(screen.getByText("Drop this file again to import it")).toBeInTheDocument()
  rerender(<RowItem row={row({ staged: true })} needsFile onOpen={jest.fn()} onRemove={jest.fn()} onToggleEncrypted={jest.fn()} onSelect={jest.fn()} selected={false} />)
  expect(screen.queryByText("Drop this file again to import it")).not.toBeInTheDocument()
})

it("has Remove as the only way to leave a book out: no Skip, a clear label and a tooltip", () => {
  const onRemove = jest.fn()
  render(<RowItem row={row()} needsFile={false} onOpen={jest.fn()} onRemove={onRemove} onToggleEncrypted={jest.fn()} onSelect={jest.fn()} selected={false} />)
  expect(screen.queryByRole("button", { name: /skip/i })).not.toBeInTheDocument()
  const remove = screen.getByRole("button", { name: "Remove Dune from this list" })
  expect(remove).toHaveAttribute("title", "The book is not imported. Drop the file again to bring it back.")
  fireEvent.click(remove)
  expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
})

it("has a checkbox that reports selection, and none to tick while importing", () => {
  const onSelect = jest.fn()
  const { rerender } = render(<RowItem row={row()} needsFile={false} onOpen={jest.fn()} onRemove={jest.fn()} onToggleEncrypted={jest.fn()} onSelect={onSelect} selected={false} />)
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Dune" }))
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), true)
  rerender(<RowItem row={row({ state: "importing" })} needsFile={false} onOpen={jest.fn()} onRemove={jest.fn()} onToggleEncrypted={jest.fn()} onSelect={onSelect} selected={false} />)
  expect(screen.getByRole("checkbox", { name: "Select Dune" })).toBeDisabled()
})
