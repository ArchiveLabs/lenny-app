import type { PickedFile } from "./walk"

// File System Access API (Chromium desktop only): lets the page remember the chosen folder
// across a reload. Everything here is feature-detected; other browsers use drop-again.
type Dir = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemHandle>
  queryPermission(d: { mode: "read" }): Promise<PermissionState>
  requestPermission(d: { mode: "read" }): Promise<PermissionState>
}

const DB = "lenny-import"
const STORE = "handles"
const KEY = "folder"

export const supportsDirectoryPicker = () =>
  Boolean(
    typeof window !== "undefined" &&
      window.isSecureContext &&
      "showDirectoryPicker" in window &&
      !window.matchMedia?.("(pointer: coarse)").matches,
  )

/** Opens the folder picker. Resolves null if the admin cancels. */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (window as unknown as { showDirectoryPicker(o: object): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: "read" })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null
    throw e
  }
}

const open = () =>
  new Promise<IDBDatabase>((ok, fail) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => ok(req.result)
    req.onerror = () => fail(req.error)
  })

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((ok, fail) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => ok(req.result)
      req.onerror = () => fail(req.error)
    })
  } finally {
    db.close()
  }
}

// Storage can be blocked (private window); remembering the folder is a convenience, never an error.
export const saveHandle = (h: FileSystemDirectoryHandle) => run("readwrite", (s) => s.put(h, KEY)).then(() => true, () => false)
export const loadHandle = () =>
  run<FileSystemDirectoryHandle | undefined>("readonly", (s) => s.get(KEY)).catch(() => undefined)
export const clearHandle = () => run("readwrite", (s) => s.delete(KEY)).then(() => undefined, () => undefined)

/** Must be called from a click: requestPermission needs a user gesture. */
export async function ensureReadPermission(h: FileSystemDirectoryHandle): Promise<boolean> {
  const d = h as Dir
  if ((await d.queryPermission({ mode: "read" })) === "granted") return true
  return (await d.requestPermission({ mode: "read" })) === "granted"
}

/** Every file under the folder, paths rooted at the folder name. Hidden entries are skipped. */
export async function walkDirectory(h: FileSystemDirectoryHandle, prefix = h.name): Promise<PickedFile[]> {
  const out: PickedFile[] = []
  for await (const entry of (h as Dir).values()) {
    if (entry.name.startsWith(".")) continue
    if (entry.kind === "file") out.push({ file: await (entry as FileSystemFileHandle).getFile(), path: `${prefix}/${entry.name}` })
    else out.push(...(await walkDirectory(entry as FileSystemDirectoryHandle, `${prefix}/${entry.name}`)))
  }
  return out
}
