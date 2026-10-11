// @ts-nocheck
import { render, screen } from "@testing-library/react"
import { RowItem } from "./RowItem"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

const row = (over = {}) => ({
  id: 1, path: "L/a.epub", size: 1, mtime: 1, state: "matched", decision: "auto", skipped: false, staged: false,
  encrypted: false, auto_picked: false, candidates_count: 0, title: "Dune", ...over,
})
const show = (r, needsFile = false) =>
  render(<RowItem row={r} needsFile={needsFile} onOpen={jest.fn()} onToggleSkip={jest.fn()} onRemove={jest.fn()} onToggleEncrypted={jest.fn()} />)

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
  rerender(<RowItem row={row({ staged: true })} needsFile onOpen={jest.fn()} onToggleSkip={jest.fn()} onRemove={jest.fn()} onToggleEncrypted={jest.fn()} />)
  expect(screen.queryByText("Drop this file again to import it")).not.toBeInTheDocument()
})
