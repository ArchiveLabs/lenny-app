import { PreloadCatalogSchema, formatSize, parseBookList } from "./preload"

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
