// @ts-nocheck
import { render, screen } from "@testing-library/react"
import ImportHub from "./page"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

it("lists the upload source and the redeem sources as links", () => {
  render(<ImportHub />)
  expect(screen.getByRole("heading", { name: "Import" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Redeem" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /Upload Files from Computer/ })).toHaveAttribute("href", "/import/upload")
  expect(screen.getByRole("link", { name: /Redeem from BRIET Marketplace/ })).toHaveAttribute("href", "/import/briet")
})

it("shows marketplace search as unavailable, not a link", () => {
  render(<ImportHub />)
  expect(screen.queryByRole("link", { name: /Search all Marketplaces/ })).not.toBeInTheDocument()
  expect(screen.getByText("Search all Marketplaces...").closest("[aria-disabled]")).toBeTruthy()
})
