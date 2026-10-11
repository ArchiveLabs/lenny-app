import { z } from "zod"

// Mirrors the lenny API contract for preloaded (Standard Ebooks) books, /admin/preload/*.
export const PreloadBookSchema = z.object({
  olid: z.number(),
  title: z.string(),
  authors: z.array(z.string()).default([]),
  year: z.number().nullish(),
  cover_url: z.string().nullish(),
  subjects: z.array(z.string()).default([]),
  source: z.string().default("standardebooks"),
  source_id: z.string(),
  size: z.number().nullish(), // bytes
  in_library: z.boolean().default(false),
  added_at: z.string().nullish(), // when it was added to the archive.org item; null for books from other items
  is_new: z.boolean().default(false), // added in the last 14 days
})
export type PreloadBook = z.infer<typeof PreloadBookSchema>

// GET /admin/preload/books/{olid}: the catalog fields plus what Open Library knows. When Open Library did not answer,
// details_loaded is false and only the catalog fields are present; any of the rest can be null or empty.
export const PreloadBookDetailsSchema = PreloadBookSchema.extend({
  cover_url_large: z.string().nullish(),
  publisher: z.string().nullish(),
  publish_date: z.string().nullish(),
  pages: z.number().nullish(),
  isbn: z.string().nullish(),
  languages: z.array(z.string()).default([]),
  description: z.string().nullish(),
  all_subjects: z.array(z.string()).default([]),
  links: z
    .object({ open_library: z.string().nullish(), standard_ebooks: z.string().nullish(), archive_org: z.string().nullish() })
    .partial()
    .default({}),
  details_loaded: z.boolean().default(true),
})
export type PreloadBookDetails = z.infer<typeof PreloadBookDetailsSchema>

// GET /admin/items/{olid}/metadata: the same shape for any book in the library. A book that is not from Standard
// Ebooks has no source_id, size or added_at, and when Open Library did not answer even the title is null.
// Nearly anything can be null here (Open Library knows little about many books), so every field is lenient.
const list = <T extends z.ZodType>(item: T) => z.array(item).nullish().transform((v) => v ?? [])
const flag = z.boolean().nullish().transform((v) => v ?? false)
export const LibraryBookMetadataSchema = PreloadBookDetailsSchema.extend({
  title: z.string().nullish(),
  source: z.string().nullish(), // a book that is not from Standard Ebooks has none
  source_id: z.string().nullish(),
  authors: list(z.string()),
  subjects: list(z.string()),
  languages: list(z.string()),
  all_subjects: list(z.string()),
  in_library: flag,
  is_new: flag,
  details_loaded: z.boolean().nullish().transform((v) => v ?? true),
  links: z
    .object({ open_library: z.string().nullish(), standard_ebooks: z.string().nullish(), archive_org: z.string().nullish() })
    .nullish()
    .transform((v) => v ?? {}),
})
export type LibraryBookMetadata = z.infer<typeof LibraryBookMetadataSchema>

export const PreloadCatalogSchema = z.object({
  books: z.array(PreloadBookSchema),
  total: z.number(),
  available: z.number(),
  known: z.number().default(0),
  in_library: z.number().default(0),
  new: z.number().default(0), // how many books are new
  updated_at: z.string().nullish(), // the archive.org item's last update (UTC)
  refreshing: z.boolean().default(false), // a rebuild is running right now
  // The server pages by offset, so this arrives as a number; kept as a string because it only travels back as ?cursor=.
  next_cursor: z.union([z.string(), z.number()]).nullable().optional().transform((v) => (v == null ? v : String(v))),
})
export type PreloadCatalog = z.infer<typeof PreloadCatalogSchema>

export const PreloadRefreshSchema = z.object({ started: z.boolean() })

export const PreloadCollectionsSchema = z.object({
  collections: z.array(z.object({ id: z.string(), name: z.string(), count: z.number(), in_library: z.number().default(0) })),
})

export const PreloadImportResultSchema = z.object({
  queued: z.number(),
  already_in_library: z.number().default(0),
  unknown: z.array(z.union([z.string(), z.number()])).default([]),
  size: z.number().nullish(),
})
export type PreloadImportResult = z.infer<typeof PreloadImportResultSchema>

export interface PreloadImportBody {
  olids?: number[]
  source_ids?: string[]
  collection?: string
}

/** Max ids the API takes in one listed request; a collection can be larger. */
export const MAX_LISTED_IDS = 200

const SITE = /^https?:\/\/standardebooks\.org\/ebooks\//i

/**
 * Turn pasted text into an import body. Numbers and OL123M keys are edition ids,
 * anything else (e.g. "jane-austen/pride-and-prejudice" or its standardebooks.org URL) is a Standard Ebooks id.
 */
export function parseBookList(text: string): PreloadImportBody {
  const olids = new Set<number>()
  const sourceIds = new Set<string>()
  for (const raw of text.split(/[\s,;]+/)) {
    const token = raw.trim()
    if (!token) continue
    const ol = token.match(/^(?:OL)?(\d+)M?$/i)
    if (ol) olids.add(Number(ol[1]))
    else sourceIds.add(token.replace(SITE, "").replace(/\/+$/, ""))
  }
  const body: PreloadImportBody = {}
  if (olids.size) body.olids = [...olids]
  if (sourceIds.size) body.source_ids = [...sourceIds]
  return body
}

export const formatSize = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
