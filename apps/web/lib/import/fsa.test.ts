// @ts-nocheck
// jsdom has no structuredClone, which fake-indexeddb needs; set it up before loading anything.
global.structuredClone = global.structuredClone ?? ((v) => JSON.parse(JSON.stringify(v)))
require("fake-indexeddb/auto")
const { clearHandle, ensureReadPermission, loadHandle, saveHandle, supportsDirectoryPicker, walkDirectory } = require("./fsa")

const fileHandle = (name: string) => ({ kind: "file", name, getFile: async () => new File(["x"], name) })
const dirHandle = (name: string, kids: any[]) => ({
  kind: "directory",
  name,
  async *values() {
    yield* kids
  },
})

describe("walkDirectory", () => {
  it("walks nested folders, rooted at the folder name, skipping hidden entries", async () => {
    const root = dirHandle("Library", [
      fileHandle("a.epub"),
      fileHandle(".DS_Store"),
      dirHandle("sub", [fileHandle("b.epub"), dirHandle(".git", [fileHandle("x.epub")])]),
    ])
    const got = await walkDirectory(root as any)
    expect(got.map((p) => p.path)).toEqual(["Library/a.epub", "Library/sub/b.epub"])
  })
})

describe("ensureReadPermission", () => {
  it("does not prompt when already granted", async () => {
    const h = { queryPermission: jest.fn().mockResolvedValue("granted"), requestPermission: jest.fn() }
    expect(await ensureReadPermission(h as any)).toBe(true)
    expect(h.requestPermission).not.toHaveBeenCalled()
  })
  it("asks, and reports a refusal", async () => {
    const h = { queryPermission: jest.fn().mockResolvedValue("prompt"), requestPermission: jest.fn().mockResolvedValue("denied") }
    expect(await ensureReadPermission(h as any)).toBe(false)
    expect(h.requestPermission).toHaveBeenCalledWith({ mode: "read" })
  })
})

describe("remembered folder", () => {
  it("round-trips through IndexedDB and can be cleared", async () => {
    expect(await loadHandle()).toBeUndefined()
    expect(await saveHandle({ kind: "directory", name: "Library" } as any)).toBe(true)
    expect((await loadHandle())?.name).toBe("Library")
    await clearHandle()
    expect(await loadHandle()).toBeUndefined()
  })
})

it("is not offered without the API (jsdom has no showDirectoryPicker)", () => {
  expect(supportsDirectoryPicker()).toBe(false)
})
