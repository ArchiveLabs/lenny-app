// @ts-nocheck
import { render, screen } from "@testing-library/react"
import MarketplacesPage from "./page"

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))

it("lists BRIET and links to its redeem page", () => {
  render(<MarketplacesPage />)
  expect(screen.getByRole("link", { name: /BRIET Marketplace/ })).toHaveAttribute("href", "/import/briet")
})
