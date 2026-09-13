import { LennyBook } from "@/types/api"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"

export function parseItems(data: Record<string, any>): LennyBook[] {
  return Object.entries(data)
    .filter(([, item]) => item.lenny != null)
    .map(([rawId, item]) => ({
      olid: `OL${rawId}M`,
      title: item.title ?? "Unknown Title",
      author_name: item.author_name ?? [],
      cover_i: item.editions?.docs?.[0]?.cover_i,
      lenny: item.lenny,
    }))
}

// Bounded full-library fetch, shared across pages that need to look a book
// up by edition key (e.g. Active Loans linking a row to its book detail).
export async function fetchAllLibraryItems(): Promise<LennyBook[]> {
  const res = await fetchAdmin(`items?limit=500`)
  return handleApiResponse<Record<string, any>>(res).then(parseItems)
}

// loan.edition_key and book.olid aren't guaranteed to share the same
// "OL...M" formatting — compare on the numeric OLID only.
export function sameEdition(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const digitsA = a.replace(/\D/g, "")
  const digitsB = b.replace(/\D/g, "")
  return digitsA.length > 0 && digitsA === digitsB
}
