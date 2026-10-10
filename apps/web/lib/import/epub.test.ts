/** @jest-environment node */
// @ts-nocheck
import { crc32, deflateRawSync } from "node:zlib"
import { parseOpf, readEpubMetadata } from "./epub"

// Minimal zip writer so the tests build real archives without a zip dependency.
function zip(files: Record<string, string>, opts: { comment?: string } = {}) {
  const parts: Buffer[] = []
  const dir: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text)
    const stored = name === "mimetype"
    const data = stored ? raw : deflateRawSync(raw)
    const n = Buffer.from(name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(stored ? 0 : 8, 8)
    local.writeUInt32LE(crc32(raw), 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(n.length, 26)
    parts.push(local, n, data)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0)
    c.writeUInt16LE(stored ? 0 : 8, 10)
    c.writeUInt32LE(crc32(raw), 16)
    c.writeUInt32LE(data.length, 20)
    c.writeUInt32LE(raw.length, 24)
    c.writeUInt16LE(n.length, 28)
    c.writeUInt32LE(offset, 42)
    dir.push(c, n)
    offset += 30 + n.length + data.length
  }
  const dirBuf = Buffer.concat(dir)
  const comment = Buffer.from(opts.comment ?? "")
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(dirBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(comment.length, 20)
  return new Blob([Buffer.concat([...parts, dirBuf, end, comment])])
}

const OPF = `<?xml version="1.0"?><package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata>
  <dc:title>Dune &amp; Sons</dc:title><dc:creator>Frank Herbert</dc:creator><dc:creator>Brian</dc:creator>
  <dc:language>en</dc:language><dc:publisher>Ace</dc:publisher><dc:date>1990-05-01</dc:date>
  <dc:identifier id="id">urn:uuid:123</dc:identifier><dc:identifier>urn:isbn:978-0-441-17271-9</dc:identifier>
</metadata></package>`
const CONTAINER = `<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`
const epub = (extra = {}) =>
  zip({ mimetype: "application/epub+zip", "META-INF/container.xml": CONTAINER, "OEBPS/content.opf": OPF }, extra)

describe("readEpubMetadata", () => {
  it("reads title, authors, language, publisher, year and ISBN", async () => {
    expect(await readEpubMetadata(epub())).toEqual({
      kind: "epub",
      meta: { title: "Dune & Sons", author: "Frank Herbert, Brian", language: "en", publisher: "Ace", year: 1990, isbn: "9780441172719" },
    })
  })

  it("finds the directory behind a zip comment", async () => {
    expect((await readEpubMetadata(epub({ comment: "x".repeat(5000) }))).kind).toBe("epub")
  })

  it("rejects a zip whose mimetype is not epub", async () => {
    expect(await readEpubMetadata(zip({ mimetype: "application/zip" }))).toEqual({ kind: "not_epub" })
  })

  it("rejects non-zip bytes and tiny files", async () => {
    expect(await readEpubMetadata(new Blob(["%PDF-1.7 not a zip".repeat(20)]))).toEqual({ kind: "not_epub" })
    expect(await readEpubMetadata(new Blob([]))).toEqual({ kind: "not_epub" })
  })

  it("reports an epub with no package file as an error", async () => {
    const r = await readEpubMetadata(zip({ mimetype: "application/epub+zip" }))
    expect(r.kind).toBe("error")
  })
})

describe("parseOpf", () => {
  it("omits missing fields and ignores non-ISBN identifiers", () => {
    expect(parseOpf("<dc:title>Only</dc:title><dc:identifier>urn:uuid:abc</dc:identifier>")).toEqual({ title: "Only" })
  })
})
