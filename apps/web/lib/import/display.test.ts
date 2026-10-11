// @ts-nocheck
import { displayAuthor, displayTitle, displayYear, editionKey, needsDetails } from "./display"

const linked = { olid: 5, title: "File", author: "File Author", path: "a/b.epub", match_title: "Match", match_author: "Match Author", match_year: 1965 }

it("builds an edition key", () => expect(editionKey(62577329)).toBe("OL62577329M"))

describe("a linked book", () => {
  it("is shown as Open Library describes it", () => {
    expect(displayTitle(linked)).toBe("Match")
    expect(displayAuthor(linked)).toBe("Match Author")
    expect(displayYear(linked)).toBe(1965)
  })
  it("shows its OL id, not the file's title, when the match has no title", () => {
    expect(displayTitle({ ...linked, match_title: null })).toBe("OL5M")
  })
  it("never borrows the file's author", () => expect(displayAuthor({ ...linked, match_author: null })).toBeNull())
  it("shows no year when the match has none", () => expect(displayYear({ ...linked, match_year: null })).toBeNull())
})

describe("an unlinked book", () => {
  const plain = { ...linked, olid: null }
  it("shows the file's own title and author", () => {
    expect(displayTitle(plain)).toBe("File")
    expect(displayAuthor(plain)).toBe("File Author")
  })
  it("falls back to the file name", () => expect(displayTitle({ ...plain, title: null })).toBe("b.epub"))
  it("never shows a year, since the file's is a placeholder", () => expect(displayYear({ ...plain, match_year: 1965 })).toBeNull())
})

describe("needsDetails", () => {
  it("is true for a linked row with no matched title", () => expect(needsDetails({ olid: 5, match_title: null, state: "matched" })).toBe(true))
  it("is false once it has one, when unlinked, or while importing", () => {
    expect(needsDetails({ olid: 5, match_title: "x", state: "matched" })).toBe(false)
    expect(needsDetails({ olid: null, match_title: null, state: "matched" })).toBe(false)
    expect(needsDetails({ olid: 5, match_title: null, state: "importing" })).toBe(false)
  })
})
