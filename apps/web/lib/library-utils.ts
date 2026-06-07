import { LennyBook } from "@/types/api"

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
