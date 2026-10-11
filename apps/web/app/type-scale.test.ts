/** @jest-environment node */
import { readFileSync } from "node:fs"
import { join } from "node:path"

const css = readFileSync(join(__dirname, "../../../packages/ui/src/styles/globals.css"), "utf8")
const base = css.slice(css.indexOf("@layer base"))

const sizeAt = (query: string | null) => {
  const re = query
    ? new RegExp(`@media \\(${query}\\) \\{\\s*html \\{\\s*font-size: (\\d+)px;`)
    : /html \{\s*font-size: (\d+)px;/
  return Number(base.match(re)?.[1])
}

describe("the root font size", () => {
  it("is smallest on phones", () => expect(sizeAt(null)).toBe(13))
  it("steps up on large phones and small tablets", () => expect(sizeAt("min-width: 640px")).toBe(14))
  it("steps up again on tablets", () => expect(sizeAt("min-width: 768px")).toBe(15))
  it("is the full 16px on a desktop", () => expect(sizeAt("min-width: 1024px")).toBe(16))

  it("only ever grows with the screen", () => {
    expect(sizeAt(null)).toBeLessThan(sizeAt("min-width: 640px"))
    expect(sizeAt("min-width: 640px")).toBeLessThan(sizeAt("min-width: 768px"))
    expect(sizeAt("min-width: 768px")).toBeLessThan(sizeAt("min-width: 1024px"))
  })

  it("is not scaled by the browser's text size adjustment", () => {
    expect(base).toContain("-webkit-text-size-adjust: 100%")
  })
})

describe("form fields on small screens", () => {
  it("stay at 16px so iOS does not zoom the page when one is focused", () => {
    const block = base.match(/@media \(max-width: 767px\) \{\s*input,\s*select,\s*textarea \{\s*font-size: (\d+)px;/)
    expect(Number(block?.[1])).toBe(16)
  })
})

it("is set on html, so every rem-based size scales with it", () => {
  expect(base).toMatch(/\n  html \{/)
  expect(base).not.toMatch(/\n  body \{[^}]*font-size/)
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
