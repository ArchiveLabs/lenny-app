import type { ImportRow } from "@/types/import"

export const editionKey = (olid: number) => `OL${olid}M`

type Shown = Pick<ImportRow, "olid" | "match_title" | "match_author" | "match_year" | "title" | "author" | "path">

/** A linked book is shown as Open Library describes it; only an unlinked one falls back to the file's own words. */
export const displayTitle = (r: Shown): string =>
  r.olid ? r.match_title || editionKey(r.olid) : r.title || r.path.split("/").pop() || r.path

export const displayAuthor = (r: Shown): string | null | undefined => (r.olid ? r.match_author : r.author)

/** Open Library's year only. The EPUB's own date is often a placeholder, so it is never the row's year. */
export const displayYear = (r: Shown): number | null | undefined => (r.olid ? r.match_year : null)

/** Linked, but the match details are empty: old data that the server can fill in. */
export const needsDetails = (r: Pick<ImportRow, "olid" | "match_title" | "state">) =>
  !!r.olid && !r.match_title && r.state !== "importing"
