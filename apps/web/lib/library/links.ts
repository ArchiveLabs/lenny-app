import { z } from "zod"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"

// GET /admin/library/links: where this library can be reached from outside, for sharing.
export const LibraryLinksSchema = z.object({
  base_url: z.string().nullish(),
  source: z.string().nullish(), // "configured" (LENNY_PUBLIC_URL) or "request" (the address the admin is browsing from)
  is_public: z.boolean().default(true), // false: only works on this machine or network
  opds_feed: z.string(),
  opds_search: z.string().nullish(),
  opds_book_template: z.string(), // contains {olid}
  reader_url: z.string(),
})
export type LibraryLinks = z.infer<typeof LibraryLinksSchema>

export const fetchLibraryLinks = () => fetchAdmin("library/links").then((r) => handleApiResponse(r, LibraryLinksSchema))

/** The number in an edition key: OL123M becomes 123. */
export const editionNumber = (olid: string | number) => String(olid).replace(/\D/g, "")

/** The OPDS link to share for one book. */
export const bookLink = (links: LibraryLinks, olid: string | number) => links.opds_book_template.replace("{olid}", editionNumber(olid))
