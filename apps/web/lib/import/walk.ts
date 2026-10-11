// Collects files from a drop or a folder picker. Dotfiles and dot-folders are
// skipped (.DS_Store, .git); everything else is returned so non-EPUBs can be
// listed as "not an EPUB" instead of silently vanishing.
export interface PickedFile {
  file: File
  /** Path relative to what was dropped, e.g. "Library/a/book.epub" */
  path: string
}

export const isEpubName = (name: string) => /\.epub$/i.test(name)

const hidden = (name: string) => name.startsWith(".")

const readFile = (e: FileSystemFileEntry) => new Promise<File>((ok, fail) => e.file(ok, fail))

async function readAll(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = dir.createReader()
  const all: FileSystemEntry[] = []
  // readEntries returns at most ~100 per call (Chromium); loop until empty.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((ok, fail) => reader.readEntries(ok, fail))
    if (!batch.length) return all
    all.push(...batch)
  }
}

async function walk(entry: FileSystemEntry, out: PickedFile[], prefix = ""): Promise<void> {
  if (hidden(entry.name)) return
  if (entry.isFile) {
    out.push({ file: await readFile(entry as FileSystemFileEntry), path: prefix + entry.name })
  } else if (entry.isDirectory) {
    for (const child of await readAll(entry as FileSystemDirectoryEntry)) {
      await walk(child, out, `${prefix}${entry.name}/`)
    }
  }
}

export async function collectDropped(items: DataTransferItemList): Promise<PickedFile[]> {
  // webkitGetAsEntry only works synchronously inside the drop event, so grab all first.
  // Index the list: it is array-like and must be read before the handler returns.
  const entries: FileSystemEntry[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (item.kind !== "file") continue
    const entry = item.webkitGetAsEntry()
    // Some browsers return no entry; fall back to the plain file.
    if (entry) entries.push(entry)
    else {
      const f = item.getAsFile()
      if (f) entries.push({ name: f.name, isFile: true, isDirectory: false, file: (ok: (f: File) => void) => ok(f) } as unknown as FileSystemEntry)
    }
  }
  const out: PickedFile[] = []
  for (const e of entries) await walk(e, out)
  return out
}

/** From <input type=file> (with or without webkitdirectory). */
export function collectInput(files: FileList | File[]): PickedFile[] {
  return [...files]
    .map((file) => ({ file, path: file.webkitRelativePath || file.name }))
    .filter(({ path }) => !path.split("/").some(hidden))
}
