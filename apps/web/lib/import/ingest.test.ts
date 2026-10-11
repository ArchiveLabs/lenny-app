// @ts-nocheck
import { chunk, ingest, pool } from "./ingest"
import { readEpubMetadata } from "./epub"

jest.mock("./epub", () => ({ readEpubMetadata: jest.fn() }))

const pick = (path: string) => ({ file: new File(["x"], path.split("/").pop()), path })

it("sends normalised paths (forward slashes, NFC)", async () => {
  readEpubMetadata.mockResolvedValue({ kind: "epub", meta: {} })
  const rows = await ingest([{ file: new File(["x"], "Cafe\u0301.epub"), path: "Lib\\Cafe\u0301.epub" }])
  expect(rows[0].path).toBe("Lib/Caf\u00e9.epub")
})

it("chunk splits into groups of n", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  expect(chunk([], 500)).toEqual([])
})

it("pool caps concurrency and keeps order", async () => {
  let live = 0
  let peak = 0
  const out = await pool([1, 2, 3, 4, 5, 6], 2, async (n) => {
    peak = Math.max(peak, ++live)
    await new Promise((r) => setTimeout(r, 5))
    live--
    return n * 2
  })
  expect(out).toEqual([2, 4, 6, 8, 10, 12])
  expect(peak).toBe(2)
})

describe("ingest", () => {
  beforeEach(() => readEpubMetadata.mockReset())

  it("reads metadata for epubs and flags everything else not_epub", async () => {
    readEpubMetadata.mockImplementation(async () => ({ kind: "epub", meta: { title: "T", isbn: "9780000000002" } }))
    const rows = await ingest([pick("L/a.epub"), pick("L/n.pdf")])
    expect(rows[0]).toMatchObject({ path: "L/a.epub", title: "T", isbn: "9780000000002" })
    expect(rows[0].state).toBeUndefined()
    expect(rows[1]).toMatchObject({ path: "L/n.pdf", state: "not_epub" })
    expect(readEpubMetadata).toHaveBeenCalledTimes(1)
  })

  it("marks a .epub that is not a valid EPUB as not_epub; read errors keep the row without metadata", async () => {
    readEpubMetadata
      .mockResolvedValueOnce({ kind: "not_epub" })
      .mockResolvedValueOnce({ kind: "error", message: "Zip64" })
    const rows = await ingest([pick("a.epub"), pick("b.epub")])
    expect(rows[0].state).toBe("not_epub")
    expect(rows[1]).toEqual({ path: "b.epub", size: 1, mtime: expect.any(Number) })
  })

  it("reports progress", async () => {
    readEpubMetadata.mockResolvedValue({ kind: "epub", meta: {} })
    const seen: number[] = []
    await ingest([pick("a.epub"), pick("b.epub")], (d) => seen.push(d))
    expect(seen).toEqual([1, 2])
  })
})
