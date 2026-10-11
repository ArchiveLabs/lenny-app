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
})
export type PreloadBook = z.infer<typeof PreloadBookSchema>

export const PreloadCatalogSchema = z.object({
  books: z.array(PreloadBookSchema),
  total: z.number(),
  available: z.number(),
  known: z.number().default(0),
  in_library: z.number().default(0),
  next_cursor: z.string().nullable().optional(),
})
export type PreloadCatalog = z.infer<typeof PreloadCatalogSchema>

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
