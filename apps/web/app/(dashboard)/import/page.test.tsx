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

it("links marketplace search to the marketplaces page", () => {
  render(<ImportHub />)
  expect(screen.getByRole("link", { name: /Search all Marketplaces/ })).toHaveAttribute("href", "/import/marketplaces")
})

it("links the free books source", () => {
  render(<ImportHub />)
  expect(screen.getByRole("link", { name: /Free books/ })).toHaveAttribute("href", "/import/free-books")
})
