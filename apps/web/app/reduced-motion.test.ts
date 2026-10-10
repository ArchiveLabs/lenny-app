// @ts-nocheck
import { readFileSync } from "fs"
import { join } from "path"

const css = readFileSync(join(__dirname, "../../../packages/ui/src/styles/globals.css"), "utf8")

describe("globals.css reduced motion", () => {
  it("shortens animations and transitions when the user prefers reduced motion", () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*{([\s\S]*?)\n}\n/)?.[1] ?? ""
    expect(block).toMatch(/animation-duration:\s*0\.01ms !important/)
    expect(block).toMatch(/animation-iteration-count:\s*1 !important/)
    expect(block).toMatch(/transition-duration:\s*0\.01ms !important/)
    expect(block).toMatch(/scroll-behavior:\s*auto !important/)
  })
})
