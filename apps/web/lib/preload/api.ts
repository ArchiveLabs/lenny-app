import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import {
  PreloadCatalogSchema, PreloadCollectionsSchema, PreloadImportResultSchema, type PreloadImportBody,
} from "@/types/preload"

export interface CatalogQuery {
  q?: string
  collection?: string
  hide_owned?: boolean
  cursor?: string
  limit?: number
}

export const preloadApi = {
  catalog: (f: CatalogQuery) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "" && v !== false) p.set(k, String(v))
    const qs = p.toString()
    return fetchAdmin(`preload/catalog${qs ? `?${qs}` : ""}`).then((r) => handleApiResponse(r, PreloadCatalogSchema))
  },
  collections: () => fetchAdmin("preload/collections").then((r) => handleApiResponse(r, PreloadCollectionsSchema)),
  importBooks: (body: PreloadImportBody) =>
    fetchAdmin("preload/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => handleApiResponse(r, PreloadImportResultSchema)),
}
