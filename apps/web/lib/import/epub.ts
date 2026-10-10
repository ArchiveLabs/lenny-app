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

const tags = (xml: string, name: string) =>
  [...xml.matchAll(new RegExp(`<(?:dc:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:dc:)?${name}>`, "gi"))]
    .map((m) => clean(m[1]!))
    .filter(Boolean)

const ISBN = /(?:^|[^0-9])(97[89]\d{10}|\d{9}[\dXx])(?![0-9])/

export function parseOpf(opf: string): EpubMeta {
  const meta: EpubMeta = {}
  const [title] = tags(opf, "title")
  const [language] = tags(opf, "language")
  const [publisher] = tags(opf, "publisher")
  const authors = tags(opf, "creator")
  const year = tags(opf, "date")[0]?.match(/\d{4}/)?.[0]
  const isbn = tags(opf, "identifier")
    .map((id) => id.replace(/[-\s]/g, "").match(ISBN)?.[1])
    .find(Boolean)
  if (title) meta.title = title
  if (authors.length) meta.author = authors.join(", ")
  if (language) meta.language = language
  if (publisher) meta.publisher = publisher
  if (year) meta.year = Number(year)
  if (isbn) meta.isbn = isbn.toUpperCase()
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
