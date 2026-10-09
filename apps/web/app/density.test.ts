// @ts-nocheck
import { readFileSync } from "fs"
import { join } from "path"

const css = readFileSync(join(__dirname, "density.css"), "utf8")

describe("density.css", () => {
  it("uses the agreed touch and mouse scale", () => {
    expect(css).toMatch(/--root-size-touch-phone:\s*15px/)
    expect(css).toMatch(/--root-size-touch-tablet:\s*14px/)
    expect(css).toMatch(/--root-size-mouse-large:\s*14px/)
    expect(css).toMatch(/--root-size-mouse-xxlarge:\s*16px/)
  })

  it("keeps touch inputs at 16px and a px tap-target floor", () => {
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*font-size:\s*16px !important/)
    expect(css).toMatch(/--tap-target:\s*44px/)
    expect(css).toMatch(/min-height:\s*var\(--tap-target\)/)
  })
})
