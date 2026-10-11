// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react"
import { EmptyLoaded } from "./EmptyLoaded"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (s: string, o?: Record<string, unknown>) => s.replace(/{{(\w+)}}/g, (_, k) => String(o?.[k])) }),
}))

it("says everything was imported and invites more files", () => {
  render(<EmptyLoaded importedCount={3} onViewHistory={jest.fn()} />)
  expect(screen.getByText("Nothing waiting to be imported")).toBeInTheDocument()
  expect(screen.getByText("Everything you loaded has been imported. Drop more files above to load them.")).toBeInTheDocument()
})

it("links to the history with its count", () => {
  const onViewHistory = jest.fn()
  render(<EmptyLoaded importedCount={3} onViewHistory={onViewHistory} />)
  fireEvent.click(screen.getByRole("button", { name: "View history (3)" }))
  expect(onViewHistory).toHaveBeenCalled()
})

it("has no history link when there is no history", () => {
  render(<EmptyLoaded importedCount={0} onViewHistory={jest.fn()} />)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})
