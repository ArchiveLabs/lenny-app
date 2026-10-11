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
  it("is smallest on phones", () => expect(sizeAt(null)).toBe(14))
  it("steps up on tablets", () => expect(sizeAt("min-width: 640px")).toBe(15))
  it("is the full 16px on a desktop", () => expect(sizeAt("min-width: 1024px")).toBe(16))

  it("only ever grows with the screen", () => {
    expect(sizeAt(null)).toBeLessThan(sizeAt("min-width: 640px"))
    expect(sizeAt("min-width: 640px")).toBeLessThan(sizeAt("min-width: 1024px"))
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
