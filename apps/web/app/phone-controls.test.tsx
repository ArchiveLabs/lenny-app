// @ts-nocheck
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

const ui = (file: string) => readFileSync(join(__dirname, "../../../packages/ui/src/components", file), "utf8")
const css = readFileSync(join(__dirname, "../../../packages/ui/src/styles/globals.css"), "utf8")

describe("buttons", () => {
  const cases = [
    ["default", "h-8", "sm:h-9"],
    ["sm", "h-7", "sm:h-8"],
    ["lg", "h-9", "sm:h-10"],
    ["icon", "size-8", "sm:size-9"],
    ["icon-sm", "size-7", "sm:size-8"],
    ["icon-lg", "size-9", "sm:size-10"],
  ]

  it.each(cases)("%s is smaller on a phone (%s) and the old size from sm up (%s)", (size, phone, desktop) => {
    render(<Button size={size}>go</Button>)
    const cls = screen.getByRole("button").className
    expect(cls).toContain(phone)
    expect(cls).toContain(desktop)
  })

  it("keeps a size a page sets itself, so the toolbar buttons that choose h-8 sm:h-9 stay as they are", () => {
    render(<Button className="h-8 sm:h-9">go</Button>)
    expect(screen.getByRole("button").className).toContain("h-8")
    expect(screen.getByRole("button").className).toContain("sm:h-9")
  })

  it("has less padding on a phone", () => {
    render(<Button>go</Button>)
    const cls = screen.getByRole("button").className
    expect(cls).toContain("px-3")
    expect(cls).toContain("sm:px-4")
  })
})

describe("fields", () => {
  it("an input is a little shorter on a phone, and full height from sm up", () => {
    render(<Input aria-label="x" />)
    const cls = screen.getByLabelText("x").className
    expect(cls).toContain("h-8")
    expect(cls).toContain("sm:h-9")
  })

  it("a select trigger is shorter on a phone too", () => {
    const src = ui("select.tsx")
    expect(src).toContain("data-[size=default]:h-8")
    expect(src).toContain("sm:data-[size=default]:h-9")
  })

  it("a toggle is shorter on a phone", () => {
    expect(ui("toggle.tsx")).toContain("h-8 min-w-8 px-2 sm:h-9 sm:min-w-9")
  })
})

describe("icons in buttons", () => {
  const block = css.slice(css.lastIndexOf("@media (max-width: 639px)"))

  it("are smaller on a phone, whatever size class the icon itself carries", () => {
    expect(block).toMatch(/\[data-slot="button"\] svg,\s*\[data-slot="select-trigger"\] svg \{\s*width: 0\.875rem;\s*height: 0\.875rem;/)
  })

  it("is outside every layer, so it beats the utility classes on the icons", () => {
    const before = css.slice(0, css.lastIndexOf("@media (max-width: 639px)"))
    const open = (before.match(/\{/g) ?? []).length
    const close = (before.match(/\}/g) ?? []).length
    expect(open).toBe(close) // every block above is closed: this rule is at the top level
  })

  it("only applies below sm", () => {
    expect(block.startsWith("@media (max-width: 639px)")).toBe(true)
  })
})
