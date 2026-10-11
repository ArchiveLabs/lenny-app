import type { NewRow } from "./api"
import { readEpubMetadata } from "./epub"
import { normPath } from "./files"
import { isEpubName, type PickedFile } from "./walk"

export const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Run `fn` over `items` with at most `n` in flight; results keep input order. */
export async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!, i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  return out
}

/**
 * Turn picked files into batch rows: read EPUB metadata in the browser, mark
 * everything that is not a readable EPUB as `not_epub`. `onProgress` fires per file.
 */
export async function ingest(picked: PickedFile[], onProgress?: (done: number, total: number) => void): Promise<NewRow[]> {
  let done = 0
  return pool(picked, 4, async ({ file, path }): Promise<NewRow> => {
    const base: NewRow = { path: normPath(path), size: file.size, mtime: file.lastModified }
    let row: NewRow = base
    if (!isEpubName(file.name)) row = { ...base, state: "not_epub" }
    else {
      const res = await readEpubMetadata(file)
      if (res.kind === "not_epub") row = { ...base, state: "not_epub" }
      else if (res.kind === "epub") row = { ...base, ...res.meta }
    }
    onProgress?.(++done, picked.length)
    return row
  })
}
