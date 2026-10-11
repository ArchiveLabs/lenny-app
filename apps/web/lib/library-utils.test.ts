// @ts-nocheck
import { parseItems } from "./library-utils"

const record = (over = {}) => ({
  title: "Database Internals", author_name: ["Alex Petrov"], editions: { docs: [{ cover_i: 5 }] },
  lenny: { id: 1, encrypted: false, formats: "EPUB", openlibrary_edition: 28933309 }, ...over,
})

describe("parseItems", () => {
  it("builds a book from a record, with an OL key from its id", () => {
    expect(parseItems({ "28933309": record() })[0]).toMatchObject({ olid: "OL28933309M", title: "Database Internals", author_name: ["Alex Petrov"], cover_i: 5 })
  })

  it("folds the top-level copy count into the record, so the book sheet can show it", () => {
    const [b] = parseItems({ "1": record({ available_copies: 0, num_lendable_total: 1 }) })
    expect(b.lenny.available_copies).toBe(0) // zero is a count: it is on loan
  })

  it("keeps a count that is already inside lenny{}", () => {
    const [b] = parseItems({ "1": record({ lenny: { ...record().lenny, available_copies: 2 } }) })
    expect(b.lenny.available_copies).toBe(2)
  })

  it("prefers the top-level count when both are there", () => {
    const [b] = parseItems({ "1": record({ available_copies: 1, lenny: { ...record().lenny, available_copies: 9 } }) })
    expect(b.lenny.available_copies).toBe(1)
  })

  it("leaves the count missing, not invented, when the server sends none", () => {
    const [b] = parseItems({ "1": record() })
    expect(b.lenny.available_copies).toBeUndefined()
  })

  it("skips records with no lenny entry, and fills a missing title and author", () => {
    const out = parseItems({ "1": { title: "x" }, "2": { lenny: { id: 2 } } })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ olid: "OL2M", title: "Unknown Title", author_name: [] })
  })
})
