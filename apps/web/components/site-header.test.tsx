// @ts-nocheck
import { render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { SiteHeader } from "./site-header"

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }))
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }))
jest.mock("@workspace/ui/components/sidebar", () => ({ SidebarTrigger: () => <button>toggle</button> }))

const at = (p) => {
  usePathname.mockReturnValue(p)
  render(<SiteHeader />)
}

it("shows the page's own title, not Lenny Dashboard", () => {
  at("/library")
  expect(screen.getByText("Lenny Library")).toHaveAttribute("aria-current", "page")
  expect(screen.queryByText("Lenny Dashboard")).not.toBeInTheDocument()
})

it("shows the section as a link and the page as the current crumb", () => {
  at("/import/upload")
  expect(screen.getByRole("link", { name: "Import & Redeem" })).toHaveAttribute("href", "/import")
  expect(screen.getByText("Upload Files from Computer")).toHaveAttribute("aria-current", "page")
})

it("nests settings pages under Settings", () => {
  at("/settings/loan-limits")
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings")
  expect(screen.getByText("Loan Limits")).toHaveAttribute("aria-current", "page")
})

it("falls back to Lenny Dashboard at the root", () => {
  at("/")
  expect(screen.getByText("Lenny Dashboard")).toBeInTheDocument()
})
