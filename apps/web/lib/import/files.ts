import type { PickedFile } from "./walk"

type Ident = { path: string; size: number; mtime: number }

/** Forward slashes and NFC: Windows sends "\", macOS gives NFD names. The server normalises the same way. */
export const normPath = (p: string) => p.replace(/\\/g, "/").normalize("NFC")
export const baseName = (p: string) => normPath(p).split("/").pop() ?? ""

export const exactKey = (r: Ident) => `${normPath(r.path)}|${r.size}|${r.mtime}`
// Same book dropped from a different folder level: path differs, name/size/mtime do not.
export const looseKey = (r: Ident) => `${baseName(r.path)}|${r.size}|${r.mtime}`

/** Files held in memory (a browser cannot keep them across a reload), found by exact path first, then by name. */
export class FileIndex {
  private exact = new Map<string, File>()
  private loose = new Map<string, File>()

  add(file: File, path: string) {
    const id = { path, size: file.size, mtime: file.lastModified }
    this.exact.set(exactKey(id), file)
    if (!this.loose.has(looseKey(id))) this.loose.set(looseKey(id), file)
  }

  get(row: Ident): File | undefined {
    return this.exact.get(exactKey(row)) ?? this.loose.get(looseKey(row))
  }

  has(row: Ident) {
    return this.get(row) !== undefined
  }

  get size() {
    return this.exact.size
  }

  /** Forget a removed row's file. The name fallback goes only if it points at this same file. */
  remove(row: Ident) {
    const f = this.get(row)
    this.exact.delete(exactKey(row))
    if (f && this.loose.get(looseKey(row)) === f) this.loose.delete(looseKey(row))
  }

  clear() {
    this.exact.clear()
    this.loose.clear()
  }
}

/**
 * The attached files. Module-level on purpose: they must outlive the page component, so leaving for the hub
 * or Free books and coming back keeps them. Cleared by Start over, never by a remount.
 */
export const importFiles = new FileIndex()

/** The rows that picked files already belong to (by exact path, or by name when dropped from another folder level). */
export function matchedRows<T extends Ident>(picked: PickedFile[], rows: T[]): T[] {
  const ids = picked.map((p) => ({ path: p.path, size: p.file.size, mtime: p.file.lastModified }))
  const exact = new Set(ids.map(exactKey))
  const loose = new Set(ids.map(looseKey))
  return rows.filter((r) => exact.has(exactKey(r)) || loose.has(looseKey(r)))
}

/** Split picked files into ones that already have a row (by exact or loose match) and brand-new ones. */
export function splitKnown(picked: PickedFile[], rows: Ident[]) {
  const exact = new Set(rows.map(exactKey))
  const loose = new Set(rows.map(looseKey))
  const known: PickedFile[] = []
  const fresh: PickedFile[] = []
  for (const p of picked) {
    const id = { path: p.path, size: p.file.size, mtime: p.file.lastModified }
    ;(exact.has(exactKey(id)) || loose.has(looseKey(id)) ? known : fresh).push(p)
  }
  return { known, fresh }
}
