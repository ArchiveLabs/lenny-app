// @ts-nocheck
import { render, screen } from "@testing-library/react"
import { SidebarProvider } from "@workspace/ui/components/sidebar"
import { usePathname } from "next/navigation"
import { IconBook, IconHelp, IconUpload } from "@tabler/icons-react"
import { NavMain, NAV_ITEM, isCurrent } from "./nav-main"
import { NavSecondary } from "./nav-secondary"

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }))

const wrap = (ui) => render(<SidebarProvider>{ui}</SidebarProvider>)
const main = [
  { title: "Import & Redeem", url: "/import", icon: IconUpload },
  { title: "Lenny Library", url: "/library", icon: IconBook },
]
const secondary = [
  { title: "Settings", url: "/settings", icon: IconBook },
  { title: "Get Help", url: "#", icon: IconHelp },
]

describe("isCurrent", () => {
  it("is the page itself", () => expect(isCurrent("/library", "/library")).toBe(true))
  it("is a page inside it", () => expect(isCurrent("/import/upload", "/import")).toBe(true))
  it("is not a page that only starts with the same letters", () => expect(isCurrent("/importer", "/import")).toBe(false))
  it("is not another page", () => expect(isCurrent("/loans", "/library")).toBe(false))
  it("is never a placeholder link or a missing path", () => {
    expect(isCurrent("/anything", "#")).toBe(false)
    expect(isCurrent(null, "/library")).toBe(false)
  })
})

describe("NavMain", () => {
  it("links each item to its page", () => {
    usePathname.mockReturnValue("/loans")
    wrap(<NavMain items={main} />)
    expect(screen.getByRole("link", { name: "Import & Redeem" })).toHaveAttribute("href", "/import")
    expect(screen.getByRole("link", { name: "Lenny Library" })).toHaveAttribute("href", "/library")
  })

  it("highlights the page you are on, and marks it as current for assistive technology", () => {
    usePathname.mockReturnValue("/library")
    wrap(<NavMain items={main} />)
    const library = screen.getByRole("link", { name: "Lenny Library" })
    expect(library).toHaveAttribute("aria-current", "page")
    expect(library).toHaveAttribute("data-active", "true")
    expect(screen.getByRole("link", { name: "Import & Redeem" })).not.toHaveAttribute("aria-current")
  })

  it("keeps the section highlighted on a page inside it", () => {
    usePathname.mockReturnValue("/import/free-books")
    wrap(<NavMain items={main} />)
    expect(screen.getByRole("link", { name: "Import & Redeem" })).toHaveAttribute("aria-current", "page")
  })

  it("highlights nothing on a page that is in neither", () => {
    usePathname.mockReturnValue("/loans")
    wrap(<NavMain items={main} />)
    expect(screen.queryAllByRole("link").filter((l) => l.hasAttribute("aria-current"))).toHaveLength(0)
  })

  it("gives every row the same height, spacing and icon size", () => {
    usePathname.mockReturnValue("/")
    wrap(<NavMain items={main} />)
    for (const name of ["Import & Redeem", "Lenny Library"]) {
      const cls = screen.getByRole("link", { name }).className
      for (const part of NAV_ITEM.split(" ")) expect(cls).toContain(part)
    }
    expect(NAV_ITEM).toContain("h-10")
    expect(NAV_ITEM).toContain("gap-3")
    expect(NAV_ITEM).toContain("[&>svg]:size-[18px]")
  })
})

describe("NavSecondary", () => {
  it("uses the same rows as the main list", () => {
    usePathname.mockReturnValue("/settings/openlibrary")
    wrap(<NavSecondary items={secondary} />)
    const settings = screen.getByRole("link", { name: "Settings" })
    expect(settings).toHaveAttribute("aria-current", "page")
    expect(settings.className).toContain("h-10")
  })

  it("never highlights a placeholder link", () => {
    usePathname.mockReturnValue("/settings")
    wrap(<NavSecondary items={secondary} />)
    expect(screen.getByRole("link", { name: "Get Help" })).not.toHaveAttribute("aria-current")
  })

  it("passes a class through, so it can sit at the bottom of the menu", () => {
    usePathname.mockReturnValue("/")
    const { container } = wrap(<NavSecondary items={secondary} className="mt-auto" />)
    expect(container.querySelector('[data-sidebar="group"]').className).toContain("mt-auto")
  })
})
