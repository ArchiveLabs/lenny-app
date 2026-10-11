import { LibraryBookMetadataSchema, PreloadBookDetailsSchema, PreloadCatalogSchema, formatSize, parseBookList } from "./preload"

describe("parseBookList", () => {
  it("splits on whitespace, commas and newlines, and dedupes", () => {
    expect(parseBookList("jane-austen/pride-and-prejudice,\n jane-austen/pride-and-prejudice  leo-tolstoy/war-and-peace")).toEqual({
      source_ids: ["jane-austen/pride-and-prejudice", "leo-tolstoy/war-and-peace"],
    })
  })
  it("treats numbers and OL keys as edition ids", () => {
    expect(parseBookList("123 OL456M ol789m")).toEqual({ olids: [123, 456, 789] })
  })
  it("strips the Standard Ebooks site address", () => {
    expect(parseBookList("https://standardebooks.org/ebooks/jane-austen/emma/")).toEqual({ source_ids: ["jane-austen/emma"] })
  })
  it("mixes both kinds and returns an empty body for blank text", () => {
    expect(parseBookList("1 a/b")).toEqual({ olids: [1], source_ids: ["a/b"] })
    expect(parseBookList("  \n ")).toEqual({})
  })
})

describe("formatSize", () => {
  it("rounds to MB and switches to GB", () => {
    expect(formatSize(0)).toBe("1 MB")
    expect(formatSize(5.4 * 1024 ** 2)).toBe("5 MB")
    expect(formatSize(1.5 * 1024 ** 3)).toBe("1.5 GB")
  })
})

it("fills defaults on a catalog page", () => {
  const c = PreloadCatalogSchema.parse({
    books: [{ olid: 1, title: "T", source_id: "a/b" }], total: 1, available: 190,
  })
  expect(c.books[0]).toMatchObject({ authors: [], in_library: false, source: "standardebooks" })
  expect(c.in_library).toBe(0)
})

describe("the catalog's next_cursor", () => {
  const page = (next_cursor?: unknown) => PreloadCatalogSchema.parse({ books: [], total: 0, available: 0, in_library: 0, ...(next_cursor === undefined ? {} : { next_cursor }) })

  it("accepts the number the server sends (an offset) and keeps it as a string for the next request", () => {
    expect(page(48).next_cursor).toBe("48")
    expect(page(0).next_cursor).toBe("0") // the first offset is still a cursor, not "no more pages"
  })
  it("accepts a string", () => expect(page("abc").next_cursor).toBe("abc"))
  it("treats null and missing as the last page", () => {
    expect(page(null).next_cursor).toBeNull()
    expect(page().next_cursor).toBeUndefined()
  })
})

describe("what is new in the catalog", () => {
  it("reads is_new, added_at and the catalog's new, updated_at and refreshing", () => {
    const c = PreloadCatalogSchema.parse({
      books: [{ olid: 1, title: "T", source_id: "a/b", is_new: true, added_at: "2026-10-01T00:00:00Z" }],
      total: 1, available: 1, new: 1, updated_at: "2026-10-11T10:00:00", refreshing: true,
    })
    expect(c.books[0]).toMatchObject({ is_new: true, added_at: "2026-10-01T00:00:00Z" })
    expect(c).toMatchObject({ new: 1, updated_at: "2026-10-11T10:00:00", refreshing: true })
  })

  it("defaults them for an older server", () => {
    const c = PreloadCatalogSchema.parse({ books: [{ olid: 1, title: "T", source_id: "a/b" }], total: 1, available: 1 })
    expect(c.books[0]).toMatchObject({ is_new: false })
    expect(c.books[0]!.added_at).toBeUndefined()
    expect(c).toMatchObject({ new: 0, refreshing: false })
  })
})

describe("a book's details", () => {
  it("reads everything Open Library adds", () => {
    const b = PreloadBookDetailsSchema.parse({
      olid: 7, title: "T", source_id: "a/b", cover_url_large: "/big.jpg", publisher: "Ace", publish_date: "2014-05-25", pages: 380, isbn: "9780000000002",
      languages: ["eng"], description: "d", all_subjects: ["x"], links: { open_library: "https://o", standard_ebooks: "https://s", archive_org: "https://a" }, details_loaded: true,
    })
    expect(b).toMatchObject({ publisher: "Ace", pages: 380, languages: ["eng"], links: { open_library: "https://o" }, details_loaded: true })
  })

  it("accepts nulls for the optional fields, and the catalog-only answer when Open Library is down", () => {
    const b = PreloadBookDetailsSchema.parse({ olid: 7, title: "T", source_id: "a/b", pages: null, isbn: null, publisher: null, description: null, size: 0, details_loaded: false })
    expect(b).toMatchObject({ pages: null, details_loaded: false, languages: [], all_subjects: [], links: {} })
  })

  it("assumes the details loaded when the server does not say", () => {
    expect(PreloadBookDetailsSchema.parse({ olid: 7, title: "T", source_id: "a/b" }).details_loaded).toBe(true)
  })
})

describe("a library book's metadata", () => {
  it("accepts a book that is not from Standard Ebooks: no source, size or added date", () => {
    const m = LibraryBookMetadataSchema.parse({ olid: 5, title: "Database Internals", authors: ["A"], source_id: null, size: null, added_at: null, links: { open_library: "https://o", standard_ebooks: null, archive_org: null }, publisher: "O'Reilly" })
    expect(m).toMatchObject({ source_id: null, publisher: "O'Reilly", details_loaded: true })
  })
  it("accepts the answer when Open Library did not answer", () => {
    expect(LibraryBookMetadataSchema.parse({ olid: 5, title: null, links: { open_library: "https://o" }, details_loaded: false }).title).toBeNull()
  })
})

describe("a library book's metadata with nulls everywhere", () => {
  it("accepts a null source, which a book that is not from Standard Ebooks has", () => {
    const m = LibraryBookMetadataSchema.parse({ olid: 5, title: "Database Internals", source: null, source_id: null, authors: ["A"] })
    expect(m.source).toBeNull()
  })

  it("turns null lists, flags and links into empty ones", () => {
    const m = LibraryBookMetadataSchema.parse({
      olid: 5, title: "T", authors: null, subjects: null, languages: null, all_subjects: null, in_library: null, is_new: null, links: null, details_loaded: null,
      publisher: null, pages: null, isbn: null, description: null, year: null, cover_url: null, cover_url_large: null, size: null, added_at: null, publish_date: null,
    })
    expect(m).toMatchObject({ authors: [], subjects: [], languages: [], all_subjects: [], in_library: false, is_new: false, links: {}, details_loaded: true })
  })

  it("accepts a plain answer as before", () => {
    const m = LibraryBookMetadataSchema.parse({ olid: 5, title: "T", source: "standardebooks", source_id: "a/b", languages: ["eng"], links: { open_library: "https://o" } })
    expect(m).toMatchObject({ source: "standardebooks", languages: ["eng"], links: { open_library: "https://o" } })
  })

  it("still needs an edition number", () => {
    expect(() => LibraryBookMetadataSchema.parse({ title: "T" })).toThrow()
  })
})
