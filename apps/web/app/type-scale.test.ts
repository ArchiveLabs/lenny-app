/** @jest-environment node */
import { readFileSync } from "node:fs"
import { join } from "node:path"

const css = readFileSync(join(__dirname, "../../../packages/ui/src/styles/globals.css"), "utf8")
const density = readFileSync(join(__dirname, "density.css"), "utf8")

describe("who sets the root font size", () => {
  it("is density.css alone: globals.css must not set it too, because density.css's rule would win and hide the mistake", () => {
    expect(css).not.toMatch(/\bhtml\s*\{[^}]*font-size/)
    expect(density).toMatch(/html\s*\{\s*font-size:\s*var\(--root-size\)/)
  })

  it("does not set the field size in globals.css either: density.css keeps touch fields at 16px", () => {
    expect(css).not.toMatch(/input,\s*select,\s*textarea\s*\{\s*font-size/)
    expect(density).toMatch(/font-size:\s*16px !important/)
  })
})

describe("page headings", () => {
  const pages = ["loans", "library", "import", "import/upload", "import/marketplaces", "import/free-books"]

  it.each(pages)("%s has a smaller heading on a phone (text-xl) and the full size from sm up", (page) => {
    const src = readFileSync(join(__dirname, `(dashboard)/${page}/page.tsx`), "utf8")
    expect(src).toContain("text-xl font-bold tracking-tight sm:text-3xl")
    expect(src).not.toMatch(/(^|[^:])text-3xl font-bold tracking-tight/)
  })
})

describe("the Library toolbar on a phone", () => {
  const src = readFileSync(join(__dirname, "(dashboard)/library/page.tsx"), "utf8")

  it("gives the search its own full-width row, so its text is not cut off", () => {
    expect(src).toContain("basis-full sm:min-w-[200px] sm:flex-1 sm:basis-auto sm:max-w-sm")
  })

  it("keeps the filter's value readable: it fills the row beside the icon buttons instead of shrinking to a chevron", () => {
    expect(src).toContain("min-w-0 flex-1 rounded-lg font-semibold sm:w-[150px] sm:flex-none")
  })

  it("keeps the icon buttons on one line", () => {
    expect(src).toContain('<div className="ml-auto flex items-center gap-2">')
  })

  it("hides the long description on a phone", () => {
    expect(src).toContain("hidden max-w-2xl text-sm text-muted-foreground sm:block")
  })
})

describe("the dashboard frame on a phone", () => {
  const layout = readFileSync(join(__dirname, "(dashboard)/layout.tsx"), "utf8")
  const sidebar = readFileSync(join(__dirname, "../../../packages/ui/src/components/sidebar.tsx"), "utf8")

  it("has a slimmer top bar below sm, and the full one from sm up", () => {
    expect(layout).toContain("[--header-height:calc(var(--spacing)*10)] sm:[--header-height:calc(var(--spacing)*12)]")
    expect(layout).not.toContain('"--header-height"') // an inline value would beat the responsive one
  })

  it("pads the page less on a phone, and grows back with the screen", () => {
    expect(layout).toContain("gap-3 p-3 sm:gap-4 sm:p-4 md:gap-6 md:p-6 lg:p-12")
  })

  it("opens the phone's menu at a narrower width", () => {
    expect(sidebar).toContain('const SIDEBAR_WIDTH_MOBILE = "15rem"')
  })

  it("keeps the desktop sidebar width", () => {
    expect(layout).toContain('"--sidebar-width": "calc(var(--spacing) * 72)"')
  })
})
