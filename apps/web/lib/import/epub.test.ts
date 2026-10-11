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

// ISBN-13 from its first 12 digits, so the tests never rely on a hand-computed check digit.
const isbn13 = (first12: string) => first12 + ((10 - ([...first12].reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10)
const meta = (inner: string) => `<package><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${inner}</metadata></package>`
const NEXT_YEAR = new Date().getFullYear() + 1

describe("parseOpf: the publication year", () => {
  it("prefers a publication event over a modification date (EPUB 2)", () => {
    const opf = meta('<dc:date opf:event="modification">2024-01-02</dc:date><dc:date opf:event="publication">2019-03-05</dc:date>')
    expect(parseOpf(opf).year).toBe(2019)
  })

  it("ignores the modified date and takes dcterms:issued (EPUB 3)", () => {
    const opf = meta('<dc:date>2024-01-02T00:00:00Z</dc:date><meta property="dcterms:modified">2024-01-02T00:00:00Z</meta><meta property="dcterms:issued">2019-03-05</meta>')
    expect(parseOpf(opf).year).toBe(2019)
  })

  it("ignores a plain date that equals the modified date, even with no issued date", () => {
    const opf = meta('<dc:date>2024-01-02T00:00:00Z</dc:date><meta property="dcterms:modified">2024-01-02T09:30:00Z</meta>')
    expect(parseOpf(opf).year).toBeUndefined()
  })

  it("takes schema:datePublished when there is no issued date", () => {
    expect(parseOpf(meta('<meta property="schema:datePublished">2017</meta><dc:date>2001</dc:date>')).year).toBe(2017)
  })

  it("orders publication, then issued, then datePublished, then a plain date", () => {
    const all = '<dc:date>2001</dc:date><meta property="schema:datePublished">2005</meta><meta property="dcterms:issued">2010</meta><dc:date opf:event="publication">2015</dc:date>'
    expect(parseOpf(meta(all)).year).toBe(2015)
    expect(parseOpf(meta('<dc:date>2001</dc:date><meta property="schema:datePublished">2005</meta><meta property="dcterms:issued">2010</meta>')).year).toBe(2010)
  })

  it("falls to the next candidate when the preferred one is not a usable year", () => {
    expect(parseOpf(meta('<dc:date opf:event="publication">1200</dc:date><dc:date>2012</dc:date>')).year).toBe(2012)
  })

  it("ignores original-publication, which is the work's year and not this edition's", () => {
    expect(parseOpf(meta('<dc:date opf:event="original-publication">1965</dc:date><dc:date>2019</dc:date>')).year).toBe(2019)
    expect(parseOpf(meta('<dc:date opf:event="original-publication">1965</dc:date>')).year).toBeUndefined()
  })

  it("treats the placeholder 1900 as missing", () => {
    expect(parseOpf(meta("<dc:date>1900-01-01</dc:date>")).year).toBeUndefined()
    expect(parseOpf(meta('<dc:date opf:event="publication">1900</dc:date><dc:date>2008</dc:date>')).year).toBe(2008)
  })

  it("rejects years before 1400 and after next year, and accepts next year", () => {
    expect(parseOpf(meta("<dc:date>1399</dc:date>")).year).toBeUndefined()
    expect(parseOpf(meta("<dc:date>1400</dc:date>")).year).toBe(1400)
    expect(parseOpf(meta(`<dc:date>${NEXT_YEAR + 1}</dc:date>`)).year).toBeUndefined()
    expect(parseOpf(meta(`<dc:date>${NEXT_YEAR}</dc:date>`)).year).toBe(NEXT_YEAR)
  })

  it("takes a four digit year out of a full date", () => {
    expect(parseOpf(meta("<dc:date>2019-03-05T10:00:00Z</dc:date>")).year).toBe(2019)
  })
})

describe("parseOpf: ISBNs", () => {
  const a = isbn13("978044117271")
  const b = isbn13("978045152493")
  const c = isbn13("978014044913")

  it("finds an ISBN in dc:source, which is often the print edition", () => {
    expect(parseOpf(meta(`<dc:source>urn:isbn:${a}</dc:source>`)).isbn).toBe(a)
  })

  it("keeps every ISBN: the first identifier is isbn, the rest isbns", () => {
    const m = parseOpf(meta(`<dc:identifier>urn:isbn:${a}</dc:identifier><dc:identifier>${b}</dc:identifier><dc:source>urn:isbn:${c}</dc:source>`))
    expect(m.isbn).toBe(a)
    expect(m.isbns).toEqual([b, c])
  })

  it("puts identifiers before dc:source whatever their order in the file", () => {
    const m = parseOpf(meta(`<dc:source>urn:isbn:${b}</dc:source><dc:identifier>urn:isbn:${a}</dc:identifier>`))
    expect(m.isbn).toBe(a)
    expect(m.isbns).toEqual([b])
  })

  it("reads an identifier marked with opf:scheme ISBN, with hyphens and spaces stripped", () => {
    const hyphenated = `${a.slice(0, 3)}-${a.slice(3, 4)}-${a.slice(4, 7)}-${a.slice(7, 12)}-${a.slice(12)}`
    expect(parseOpf(meta(`<dc:identifier opf:scheme="ISBN">${hyphenated}</dc:identifier>`)).isbn).toBe(a)
    expect(parseOpf(meta(`<dc:identifier>ISBN ${a.slice(0, 3)} ${a.slice(3)}</dc:identifier>`)).isbn).toBe(a)
  })

  it("turns an ISBN-10 into its 13-digit form, and does not list the same book twice", () => {
    const m = parseOpf(meta(`<dc:identifier>0441172717</dc:identifier><dc:source>urn:isbn:9780441172719</dc:source>`))
    expect(m.isbn).toBe("9780441172719")
    expect(m.isbns).toBeUndefined()
  })

  it("accepts an ISBN-10 ending in X", () => {
    expect(parseOpf(meta("<dc:identifier>080442957X</dc:identifier>")).isbn).toBe("9780804429573")
  })

  it("rejects numbers whose check digit is wrong", () => {
    expect(parseOpf(meta("<dc:identifier>9780441172710</dc:identifier>")).isbn).toBeUndefined()
    expect(parseOpf(meta("<dc:identifier>0441172710</dc:identifier>")).isbn).toBeUndefined()
  })

  it("ignores uuids and other identifiers", () => {
    expect(parseOpf(meta("<dc:identifier>urn:uuid:12345678-1234-1234-1234-123456789012</dc:identifier>")).isbn).toBeUndefined()
  })

  it("sends at most 5 extra ISBNs", () => {
    const many = Array.from({ length: 9 }, (_, i) => isbn13(`97800000000${i}`.slice(0, 12)))
    const m = parseOpf(meta(many.map((x) => `<dc:identifier>${x}</dc:identifier>`).join("")))
    expect(m.isbn).toBe(many[0])
    expect(m.isbns).toHaveLength(5)
    expect(m.isbns).toEqual(many.slice(1, 6))
  })
})

describe("parseOpf: the title", () => {
  it("joins a subtitle marked by a title-type refines (EPUB 3)", () => {
    const opf = meta('<dc:title id="t1">Dune</dc:title><dc:title id="t2">The Desert Planet</dc:title><meta refines="#t1" property="title-type">main</meta><meta refines="#t2" property="title-type">subtitle</meta>')
    expect(parseOpf(opf).title).toBe("Dune: The Desert Planet")
  })

  it("joins a second dc:title as the subtitle (EPUB 2)", () => {
    expect(parseOpf(meta("<dc:title>Dune</dc:title><dc:title>The Desert Planet</dc:title>")).title).toBe("Dune: The Desert Planet")
  })

  it("keeps the main title alone when there is no subtitle", () => {
    expect(parseOpf(meta("<dc:title>Dune</dc:title>")).title).toBe("Dune")
  })

  it("does not repeat a subtitle the main title already contains", () => {
    expect(parseOpf(meta("<dc:title>Dune: The Desert Planet</dc:title><dc:title>The Desert Planet</dc:title>")).title).toBe("Dune: The Desert Planet")
  })

  it("leaves out a short or collection title", () => {
    const opf = meta('<dc:title id="t1">Dune</dc:title><dc:title id="t2">Dune Chronicles 1</dc:title><meta refines="#t1" property="title-type">main</meta><meta refines="#t2" property="title-type">collection</meta>')
    expect(parseOpf(opf).title).toBe("Dune")
  })

  it("finds the main title even when the subtitle comes first in the file", () => {
    const opf = meta('<dc:title id="s">The Desert Planet</dc:title><dc:title id="m">Dune</dc:title><meta refines="#s" property="title-type">subtitle</meta><meta refines="#m" property="title-type">main</meta>')
    expect(parseOpf(opf).title).toBe("Dune: The Desert Planet")
  })
})

describe("parseOpf: the authors", () => {
  it("leaves out an editor (EPUB 2 opf:role)", () => {
    const opf = meta('<dc:creator opf:role="aut">Frank Herbert</dc:creator><dc:creator opf:role="edt">Some Editor</dc:creator>')
    expect(parseOpf(opf).author).toBe("Frank Herbert")
  })

  it("leaves out an editor, translator and illustrator (EPUB 3 refines)", () => {
    const opf = meta(
      '<dc:creator id="a">Frank Herbert</dc:creator><dc:creator id="e">An Editor</dc:creator><dc:creator id="t">A Translator</dc:creator><dc:creator id="i">An Illustrator</dc:creator>' +
        '<meta refines="#a" property="role" scheme="marc:relators">aut</meta><meta refines="#e" property="role">edt</meta><meta refines="#t" property="role">trl</meta><meta refines="#i" property="role">ill</meta>',
    )
    expect(parseOpf(opf).author).toBe("Frank Herbert")
  })

  it("counts a creator with no role, and keeps file order", () => {
    expect(parseOpf(meta('<dc:creator>First Author</dc:creator><dc:creator opf:role="aut">Second Author</dc:creator><dc:creator opf:role="trl">T</dc:creator>')).author).toBe("First Author, Second Author")
  })

  it("falls back to the others when there is no author at all", () => {
    expect(parseOpf(meta('<dc:creator opf:role="edt">Only Editor</dc:creator><dc:creator opf:role="ill">An Illustrator</dc:creator>')).author).toBe("Only Editor, An Illustrator")
  })
})

describe("parseOpf: publisher and language", () => {
  it("trims the first publisher", () => {
    expect(parseOpf(meta(`<dc:publisher>  Ace Books \n</dc:publisher><dc:publisher>Other</dc:publisher>`)).publisher).toBe("Ace Books")
  })

  it("keeps the language as written", () => {
    expect(parseOpf(meta("<dc:language>en-US</dc:language>")).language).toBe("en-US")
  })
})

describe("a full OPF", () => {
  it("reads everything the matcher uses", () => {
    const opf = meta(
      `<dc:title>Dune</dc:title><dc:creator opf:role="aut">Frank Herbert</dc:creator><dc:publisher>Ace</dc:publisher><dc:language>en</dc:language>` +
        `<dc:identifier>urn:isbn:9780441172719</dc:identifier><dc:source>urn:isbn:9780441013593</dc:source>` +
        `<dc:date opf:event="modification">2023-02-02</dc:date><dc:date opf:event="publication">2019-09-24</dc:date>`,
    )
    expect(parseOpf(opf)).toEqual({
      title: "Dune", author: "Frank Herbert", publisher: "Ace", language: "en", year: 2019, isbn: "9780441172719", isbns: ["9780441013593"],
    })
  })
})
