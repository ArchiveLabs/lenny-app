// Reads EPUB metadata from a File without loading the whole book: only the zip
// directory and two small XML entries are read via Blob.slice, so scanning
// thousands of files stays cheap. Zip64 archives are reported as errors.
export interface EpubMeta {
  title?: string
  author?: string
  isbn?: string
  language?: string
  publisher?: string
  year?: number
  /** More ISBNs found in the file (13 digits), besides `isbn`. */
  isbns?: string[]
}

export type EpubResult =
  | { kind: "epub"; meta: EpubMeta }
  | { kind: "not_epub" }
  | { kind: "error"; message: string }

interface ZipEntry {
  method: number
  compSize: number
  size: number
  offset: number
}

const MAX_XML_BYTES = 1024 * 1024 // zip-bomb guard for container.xml and the OPF
const EOCD_SIG = 0x06054b50

class NotEpub extends Error {}

const bytes = async (blob: Blob, start: number, end: number) =>
  new DataView(await blob.slice(start, end).arrayBuffer())

async function findEocd(file: Blob): Promise<DataView> {
  // The record is 22 bytes unless the zip has a comment, so try a tiny tail first.
  for (const tail of [1024, 65557]) {
    const view = await bytes(file, Math.max(0, file.size - tail), file.size)
    for (let i = view.byteLength - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === EOCD_SIG) return new DataView(view.buffer, i)
    }
    if (file.size <= tail) break
  }
  throw new NotEpub()
}

async function readDirectory(file: Blob): Promise<Map<string, ZipEntry>> {
  const eocd = await findEocd(file)
  const count = eocd.getUint16(10, true)
  const dirSize = eocd.getUint32(12, true)
  const dirOffset = eocd.getUint32(16, true)
  if (dirSize === 0xffffffff || dirOffset === 0xffffffff || count === 0xffff) {
    throw new Error("Zip64 archives are not supported")
  }
  const dir = await bytes(file, dirOffset, dirOffset + dirSize)
  const names = new TextDecoder()
  const entries = new Map<string, ZipEntry>()
  let p = 0
  for (let i = 0; i < count && p + 46 <= dir.byteLength; i++) {
    if (dir.getUint32(p, true) !== 0x02014b50) throw new NotEpub()
    const nameLen = dir.getUint16(p + 28, true)
    const name = names.decode(new Uint8Array(dir.buffer, p + 46, nameLen))
    entries.set(name, {
      method: dir.getUint16(p + 10, true),
      compSize: dir.getUint32(p + 20, true),
      size: dir.getUint32(p + 24, true),
      offset: dir.getUint32(p + 42, true),
    })
    p += 46 + nameLen + dir.getUint16(p + 30, true) + dir.getUint16(p + 32, true)
  }
  return entries
}

async function readText(file: Blob, e: ZipEntry): Promise<string> {
  if (e.size > MAX_XML_BYTES) throw new Error("EPUB metadata file is too large")
  const head = await bytes(file, e.offset, e.offset + 30)
  const start = e.offset + 30 + head.getUint16(26, true) + head.getUint16(28, true)
  const data = file.slice(start, start + e.compSize)
  if (e.method === 0) return data.text()
  if (e.method !== 8) throw new Error("Unsupported zip compression")
  const inflated = data.stream().pipeThrough(new DecompressionStream("deflate-raw"))
  return new Response(inflated).text()
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }
const clean = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, g: string) => {
      if (g[0] !== "#") return ENTITIES[g.toLowerCase()] ?? m
      const code = g.charAt(1).toLowerCase() === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    })
    .replace(/\s+/g, " ")
    .trim()

interface El {
  attrs: Record<string, string>
  text: string
}

const attrsOf = (raw: string): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const m of raw.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? ""
  return out
}

/** Elements named `name` (with or without the dc: prefix), in file order, with their attributes and cleaned text. */
const els = (xml: string, name: string, prefix = "(?:dc:)?"): El[] =>
  [...xml.matchAll(new RegExp(`<${prefix}${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${prefix}${name}>)`, "gi"))].map((m) => ({
    attrs: attrsOf(m[1] ?? ""),
    text: clean(m[2] ?? ""),
  }))

const tags = (xml: string, name: string) => els(xml, name).map((e) => e.text).filter(Boolean)
const metas = (xml: string) => els(xml, "meta", "")
const attr = (e: El, ...names: string[]) => names.map((n) => e.attrs[n]).find((v) => v !== undefined)

/** EPUB 3 `<meta refines="#id" property="x">value</meta>` values for one element id. */
const refined = (xml: string, id: string | undefined, property: string) =>
  id ? metas(xml).filter((m) => m.attrs.refines === `#${id}` && m.attrs.property === property).map((m) => m.text) : []

const ISBN = /(?:^|[^0-9])(97[89]\d{10}|\d{9}[\dXx])(?![0-9])/

function isbn13(code: string): string | null {
  const c = code.toUpperCase()
  if (/^\d{13}$/.test(c)) {
    const sum = [...c].slice(0, 12).reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0)
    return (10 - (sum % 10)) % 10 === Number(c[12]) ? c : null
  }
  if (/^\d{9}[\dX]$/.test(c)) {
    const sum = [...c].slice(0, 9).reduce((n, d, i) => n + Number(d) * (10 - i), 0) + (c[9] === "X" ? 10 : Number(c[9]))
    if (sum % 11 !== 0) return null
    const body = `978${c.slice(0, 9)}`
    const check = (10 - ([...body].reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10
    return body + check
  }
  return null
}

const isbnIn = (text: string) => {
  const found = text.replace(/[-\s]/g, "").match(ISBN)?.[1]
  return found ? isbn13(found) : null
}

/** Every valid ISBN, as 13 digits, identifiers first (they name this edition), then dc:source (often the print edition). */
function isbnsOf(opf: string): string[] {
  const seen = new Set<string>()
  for (const text of [...tags(opf, "identifier"), ...tags(opf, "source")]) {
    const code = isbnIn(text)
    if (code) seen.add(code)
  }
  return [...seen]
}

const MAX_EXTRA_ISBNS = 5
const MIN_YEAR = 1400
const PLACEHOLDER_YEAR = 1900 // what many tools write when they have no real date

const yearOf = (text: string | undefined, now = new Date().getFullYear()): number | null => {
  const y = Number(text?.match(/(?<!\d)(\d{4})(?!\d)/)?.[1])
  return y >= MIN_YEAR && y <= now + 1 && y !== PLACEHOLDER_YEAR ? y : null
}

/**
 * The year this edition was published. A dc:date is often the file's creation or modification date, so the order is
 * publication event, dcterms:issued, schema:datePublished, then a plain date; modification and original-publication
 * dates, and any date equal to the modified date, are ignored.
 */
function publicationYear(opf: string): number | null {
  const m = metas(opf)
  const modified = m.find((e) => e.attrs.property === "dcterms:modified")?.text.slice(0, 10)
  const dates = els(opf, "date").filter((d) => d.text && !(modified && d.text.slice(0, 10) === modified))
  const event = (d: El) => attr(d, "opf:event", "event")?.toLowerCase()
  const ordered = [
    ...dates.filter((d) => event(d) === "publication").map((d) => d.text),
    ...m.filter((e) => e.attrs.property === "dcterms:issued").map((e) => e.text),
    ...m.filter((e) => e.attrs.property === "schema:datePublished").map((e) => e.text),
    ...dates.filter((d) => !event(d)).map((d) => d.text),
  ]
  for (const text of ordered) {
    const y = yearOf(text)
    if (y) return y
  }
  return null
}

const SUB_TITLE_KINDS = new Set(["short", "collection", "edition", "expanded"])

/** "Title: Subtitle" when the OPF marks a subtitle (title-type refines, or a second dc:title). */
function fullTitle(opf: string): string | undefined {
  const titles = els(opf, "title").filter((t) => t.text)
  if (!titles.length) return undefined
  const kind = (t: El) => refined(opf, t.attrs.id, "title-type")[0]?.toLowerCase()
  const typed = titles.some((t) => kind(t))
  const main = titles.find((t) => kind(t) === "main") ?? titles.find((t) => !kind(t) || !SUB_TITLE_KINDS.has(kind(t)!) && kind(t) !== "subtitle") ?? titles[0]!
  const sub = typed ? titles.find((t) => kind(t) === "subtitle") : titles.find((t) => t !== main)
  return sub && !main.text.toLowerCase().includes(sub.text.toLowerCase()) ? `${main.text}: ${sub.text}` : main.text
}

/** Authors only: a creator with no role counts, and editors, translators and illustrators are left out unless nothing else exists. */
function authors(opf: string): string[] {
  const all = els(opf, "creator").filter((c) => c.text)
  const role = (c: El) => (attr(c, "opf:role", "role") ?? refined(opf, c.attrs.id, "role")[0])?.toLowerCase()
  const only = all.filter((c) => !role(c) || role(c) === "aut")
  return (only.length ? only : all).map((c) => c.text)
}

export function parseOpf(opf: string): EpubMeta {
  const meta: EpubMeta = {}
  const title = fullTitle(opf)
  const [language] = tags(opf, "language")
  const [publisher] = tags(opf, "publisher")
  const names = authors(opf)
  const year = publicationYear(opf)
  const [isbn, ...more] = isbnsOf(opf)
  if (title) meta.title = title
  if (names.length) meta.author = names.join(", ")
  if (language) meta.language = language
  if (publisher) meta.publisher = publisher
  if (year) meta.year = year
  if (isbn) meta.isbn = isbn
  if (more.length) meta.isbns = more.slice(0, MAX_EXTRA_ISBNS)
  return meta
}

export async function readEpubMetadata(file: Blob): Promise<EpubResult> {
  try {
    const entries = await readDirectory(file)
    const mimetype = entries.get("mimetype")
    if (!mimetype || (await readText(file, mimetype)).trim() !== "application/epub+zip") {
      return { kind: "not_epub" }
    }
    const container = entries.get("META-INF/container.xml")
    const opfPath = container && (await readText(file, container)).match(/full-path\s*=\s*["']([^"']+)["']/)?.[1]
    const opf = opfPath && entries.get(decodeURI(opfPath))
    if (!opf) return { kind: "error", message: "EPUB has no package file" }
    return { kind: "epub", meta: parseOpf(await readText(file, opf)) }
  } catch (e) {
    if (e instanceof NotEpub) return { kind: "not_epub" }
    return { kind: "error", message: e instanceof Error ? e.message : "Could not read file" }
  }
}
