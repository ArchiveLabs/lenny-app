// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { EmptyPreload } from "./EmptyPreload"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

it("says nothing is added yet and explains what preloading is", () => {
  render(<EmptyPreload onBrowse={jest.fn()} onPasteList={jest.fn()} />)
  expect(screen.getByText("No books added yet")).toBeInTheDocument()
  expect(screen.getByText(/free public-domain books from Standard Ebooks/)).toBeInTheDocument()
})

it("offers both ways to start", () => {
  const onBrowse = jest.fn()
  const onPasteList = jest.fn()
  render(<EmptyPreload onBrowse={onBrowse} onPasteList={onPasteList} />)
  fireEvent.click(screen.getByRole("button", { name: "Preload books" }))
  fireEvent.click(screen.getByRole("button", { name: "Paste a list" }))
  expect(onBrowse).toHaveBeenCalled()
  expect(onPasteList).toHaveBeenCalled()
})

it("disables browsing while the catalog is being asked for", () => {
  render(<EmptyPreload onBrowse={jest.fn()} onPasteList={jest.fn()} browsing />)
  expect(screen.getByRole("button", { name: "Preload books" })).toBeDisabled()
})
