// @ts-nocheck
import { FileIndex, baseName, exactKey, looseKey, normPath, splitKnown } from "./files"

const file = (name: string, size = 1, mtime = 100) => {
  const f = new File(["x".repeat(size)], name, { lastModified: mtime })
  return f
}
const row = (path: string, size = 1, mtime = 100) => ({ path, size, mtime })

describe("normPath", () => {
  it("uses forward slashes and NFC", () => {
    expect(normPath("Lib\\sub\\a.epub")).toBe("Lib/sub/a.epub")
    const nfd = "Café.epub" // macOS-style decomposed é
    expect(normPath(nfd)).toBe("Café.epub")
    expect(baseName("Lib\\sub\\" + nfd)).toBe("Café.epub")
  })
  it("gives the same keys for the same book from another OS", () => {
    expect(exactKey(row("Lib\\á.epub"))).toBe(exactKey(row("Lib/á.epub")))
  })
})

describe("FileIndex", () => {
  it("finds a file by its exact path", () => {
    const idx = new FileIndex()
    const f = file("a.epub")
    idx.add(f, "Library/a.epub")
    expect(idx.get(row("Library/a.epub"))).toBe(f)
  })

  it("reconnects when a different folder level was dropped (name, size, mtime)", () => {
    const idx = new FileIndex()
    const f = file("a.epub")
    idx.add(f, "sub/a.epub") // dropped the subfolder
    expect(idx.get(row("Library/sub/a.epub"))).toBe(f)
    expect(idx.has(row("a.epub"))).toBe(true) // loose files
  })

  it("matches a decomposed macOS name against the stored composed name", () => {
    const idx = new FileIndex()
    const f = file("Café.epub")
    idx.add(f, "Café.epub")
    expect(idx.has(row("Café.epub"))).toBe(true)
  })

  it("does not match a different size or modified time", () => {
    const idx = new FileIndex()
    idx.add(file("a.epub", 1, 100), "a.epub")
    expect(idx.has(row("a.epub", 2, 100))).toBe(false)
    expect(idx.has(row("a.epub", 1, 101))).toBe(false)
  })

  it("prefers the exact path when two folders hold the same name, size and time", () => {
    const idx = new FileIndex()
    const a = file("x.epub")
    const b = file("x.epub")
    idx.add(a, "one/x.epub")
    idx.add(b, "two/x.epub")
    expect(idx.get(row("two/x.epub"))).toBe(b)
  })

  it("counts and clears", () => {
    const idx = new FileIndex()
    idx.add(file("a.epub"), "a.epub")
    expect(idx.size).toBe(1)
    idx.clear()
    expect(idx.size).toBe(0)
    expect(idx.has(row("a.epub"))).toBe(false)
  })
})

describe("splitKnown", () => {
  it("separates files that already have a row from new ones", () => {
    const a = file("a.epub")
    const b = file("b.epub")
    const { known, fresh } = splitKnown(
      [{ file: a, path: "sub/a.epub" }, { file: b, path: "sub/b.epub" }],
      [row("Library/sub/a.epub")],
    )
    expect(known.map((p) => p.file)).toEqual([a])
    expect(fresh.map((p) => p.file)).toEqual([b])
  })
})

it("looseKey ignores directories", () => {
  expect(looseKey(row("a/b/c.epub"))).toBe(looseKey(row("c.epub")))
})
