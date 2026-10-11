/** @jest-environment node */
// @ts-nocheck
import { bookLink, editionNumber, fetchLibraryLinks, LibraryLinksSchema } from "./links"
import { fetchAdmin } from "@/lib/api-client"

jest.mock("@/lib/api-client", () => ({ ...jest.requireActual("@/lib/api-client"), fetchAdmin: jest.fn() }))

const links = (over = {}) => ({
  base_url: "https://lenny.example", source: "configured", is_public: true, opds_feed: "https://lenny.example/v1/api/opds",
  opds_search: "https://lenny.example/v1/api/opds/search?query={query}", opds_book_template: "https://lenny.example/v1/api/opds/{olid}",
  reader_url: "https://reader.archive.org/catalog?home=https%3A%2F%2Flenny.example%2Fv1%2Fapi%2Fopds", ...over,
})

describe("editionNumber", () => {
  it("takes the number out of an edition key", () => {
    expect(editionNumber("OL123M")).toBe("123")
    expect(editionNumber("OL28933309M")).toBe("28933309")
    expect(editionNumber(456)).toBe("456")
  })
})

describe("bookLink", () => {
  it("puts the edition number into the template", () => {
    expect(bookLink(links(), "OL123M")).toBe("https://lenny.example/v1/api/opds/123")
    expect(bookLink(links(), 62577329)).toBe("https://lenny.example/v1/api/opds/62577329")
  })
  it("leaves the rest of the link alone", () => {
    expect(bookLink(links({ opds_book_template: "http://localhost:8080/v1/api/opds/{olid}" }), "OL9M")).toBe("http://localhost:8080/v1/api/opds/9")
  })
})

describe("the response", () => {
  it("is read as sent", () => {
    expect(LibraryLinksSchema.parse(links())).toMatchObject({ is_public: true, source: "configured", opds_feed: "https://lenny.example/v1/api/opds" })
  })
  it("assumes public when the server does not say, and needs the three links", () => {
    expect(LibraryLinksSchema.parse(links({ is_public: undefined })).is_public).toBe(true)
    expect(() => LibraryLinksSchema.parse({ base_url: "x" })).toThrow()
  })
  it("reads a private address", () => {
    expect(LibraryLinksSchema.parse(links({ is_public: false, source: "request" })).is_public).toBe(false)
  })
  it("is fetched from the admin library links route", async () => {
    fetchAdmin.mockResolvedValue(new Response(JSON.stringify(links()), { status: 200 }))
    expect((await fetchLibraryLinks()).opds_feed).toBe("https://lenny.example/v1/api/opds")
    expect(fetchAdmin).toHaveBeenCalledWith("library/links")
  })
})

describe("readerUrl", () => {
  const { readerUrl } = require("./links")
  it("puts the feed after ?opds=, as Internet Archive's reader expects", () => {
    expect(readerUrl(links({ opds_feed: "https://lender.briet.app/v1/api/opds" }))).toBe("https://reader.archive.org/?opds=https://lender.briet.app/v1/api/opds")
  })
  it("follows whatever domain the feed has", () => {
    expect(readerUrl(links({ opds_feed: "http://localhost:8080/v1/api/opds" }))).toBe("https://reader.archive.org/?opds=http://localhost:8080/v1/api/opds")
  })
})
