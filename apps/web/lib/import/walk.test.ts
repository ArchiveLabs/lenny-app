// @ts-nocheck
import { collectDropped, collectInput, isEpubName } from "./walk"

const file = (name: string) => new File(["x"], name)
const fileEntry = (name: string) => ({ name, isFile: true, isDirectory: false, file: (ok: any) => ok(file(name)) })
// Directory whose reader hands out `pageSize` entries per call, like Chromium.
const dirEntry = (name: string, kids: any[], pageSize = 2) => ({
  name,
  isFile: false,
  isDirectory: true,
  createReader: () => {
    let i = 0
    return {
      readEntries: (ok: any) => {
        const page = kids.slice(i, i + pageSize)
        i += pageSize
        ok(page)
      },
    }
  },
})
// Array-like list, as in browsers.
const items = (...entries: any[]) => {
  const list: any = { length: entries.length }
  entries.forEach((e, i) => (list[i] = { kind: "file", webkitGetAsEntry: () => e, getAsFile: () => null }))
  return list
}

describe("collectDropped", () => {
  it("walks nested folders, paging readEntries until empty", async () => {
    const tree = dirEntry("Library", [
      fileEntry("a.epub"),
      fileEntry("b.epub"),
      dirEntry("sub", [fileEntry("c.epub"), fileEntry("d.epub"), fileEntry("e.epub")]),
    ])
    const got = await collectDropped(items(tree) as any)
    expect(got.map((p) => p.path)).toEqual([
      "Library/a.epub",
      "Library/b.epub",
      "Library/sub/c.epub",
      "Library/sub/d.epub",
      "Library/sub/e.epub",
    ])
  })

  it("skips dotfiles and dot folders but keeps non-epub files", async () => {
    const tree = dirEntry("L", [fileEntry(".DS_Store"), dirEntry(".git", [fileEntry("x.epub")]), fileEntry("n.pdf")])
    const got = await collectDropped(items(tree, fileEntry("loose.epub")) as any)
    expect(got.map((p) => p.path)).toEqual(["L/n.pdf", "loose.epub"])
  })

  it("ignores items that are not files or folders", async () => {
    expect(await collectDropped(items(null) as any)).toEqual([])
  })

  it("reads every entry before the first await (the list is emptied afterwards)", async () => {
    const list = items(fileEntry("a.epub"), fileEntry("b.epub"))
    const p = collectDropped(list)
    for (let i = 0; i < list.length; i++) list[i] = undefined // browser clears the list after the handler returns
    list.length = 0
    expect((await p).map((f) => f.path)).toEqual(["a.epub", "b.epub"])
  })

  it("falls back to getAsFile when webkitGetAsEntry gives nothing", async () => {
    const f = file("x.epub")
    const list: any = { length: 1, 0: { kind: "file", webkitGetAsEntry: () => null, getAsFile: () => f } }
    expect((await collectDropped(list)).map((p) => p.path)).toEqual(["x.epub"])
  })

  it("skips non-file drag items such as dragged text", async () => {
    const list: any = { length: 1, 0: { kind: "string", webkitGetAsEntry: () => null, getAsFile: () => null } }
    expect(await collectDropped(list)).toEqual([])
  })
})

describe("collectInput", () => {
  it("uses webkitRelativePath and drops hidden paths", () => {
    const a = file("a.epub")
    Object.defineProperty(a, "webkitRelativePath", { value: "L/a.epub" })
    const hiddenFile = file("h.epub")
    Object.defineProperty(hiddenFile, "webkitRelativePath", { value: "L/.cache/h.epub" })
    expect(collectInput([a, hiddenFile, file("loose.epub")]).map((p) => p.path)).toEqual(["L/a.epub", "loose.epub"])
  })
})

it("isEpubName is case-insensitive", () => {
  expect(isEpubName("A.EPUB")).toBe(true)
  expect(isEpubName("a.epub.pdf")).toBe(false)
})
