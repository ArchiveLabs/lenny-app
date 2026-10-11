// @ts-nocheck
import { readFileSync } from "fs"
import { join } from "path"

const css = readFileSync(join(__dirname, "density.css"), "utf8")

describe("density.css", () => {
  it("uses the agreed touch and mouse scale", () => {
    expect(css).toMatch(/--root-size-touch-phone:\s*14px/)
    expect(css).toMatch(/--root-size-touch-tablet:\s*14px/)
    expect(css).toMatch(/--root-size-mouse-large:\s*14px/)
    expect(css).toMatch(/--root-size-mouse-xxlarge:\s*16px/)
  })

  it("keeps touch inputs at 16px and a px tap-target floor", () => {
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*font-size:\s*16px !important/)
    expect(css).toMatch(/--tap-target:\s*36px/)
    expect(css).toMatch(/min-height:\s*var\(--tap-target\)/)
  })
})

describe("legibility on touch devices", () => {
  const size = (name: string) => Number(css.match(new RegExp(`--root-size-touch-${name}:\\s*(\\d+)px`))?.[1])

  it("keeps the root size at 14px or more, so small text (0.75rem) stays near 10.5px or more", () => {
    expect(size("phone")).toBeGreaterThanOrEqual(14)
    expect(size("tablet")).toBeGreaterThanOrEqual(14)
  })

  it("is smaller than the 15px it started at, as asked", () => {
    expect(size("phone")).toBeLessThan(15)
  })

  it("keeps a tap target of at least 36px, above the 24px WCAG minimum", () => {
    expect(Number(css.match(/--tap-target:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(36)
  })
})
