import { z } from "zod"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { isHttpUrl } from "@/lib/safe-url"

// These become hrefs, so only http(s) is accepted; anything else (javascript:, data:) fails the whole response.
const httpUrl = z.string().refine(isHttpUrl, "Not an http(s) URL")

// GET /admin/library/links: where this library can be reached from outside, for sharing.
export const LibraryLinksSchema = z.object({
  base_url: z.string().nullish(),
  source: z.string().nullish(), // "configured" (LENNY_PROXY is set) or "host_and_port" (built from LENNY_HOST and LENNY_PORT)
  is_public: z.boolean().default(true), // false: the configured address is localhost, a private IP or .local
  opds_feed: httpUrl,
  opds_search: z.string().nullish(),
  opds_book_template: httpUrl, // contains {olid}
  reader_url: httpUrl,
})
export type LibraryLinks = z.infer<typeof LibraryLinksSchema>

export const fetchLibraryLinks = () => fetchAdmin("library/links").then((r) => handleApiResponse(r, LibraryLinksSchema))

/** The number in an edition key: OL123M becomes 123. */
export const editionNumber = (olid: string | number) => String(olid).replace(/\D/g, "")

/** The link to share for one book: opens it in this node's built-in reader (`<reader>/?opds=<book feed>`). */
export const readerBookLink = (links: LibraryLinks, olid: string | number) =>
  `${links.reader_url.replace(/\/+$/, "")}/?opds=${encodeURIComponent(bookLink(links, olid))}`

/** The raw OPDS feed address of one book, for reading apps. */
export const bookLink = (links: LibraryLinks, olid: string | number) => links.opds_book_template.replace("{olid}", editionNumber(olid))
