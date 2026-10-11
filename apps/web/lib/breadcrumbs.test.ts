import { crumbsFor } from "./breadcrumbs"

const labels = (p: string) => crumbsFor(p).map((c) => c.label)

it.each([
  ["/import", ["Import & Redeem"]],
  ["/import/upload", ["Import & Redeem", "Upload Files from Computer"]],
  ["/import/briet", ["Import & Redeem", "Redeem from BRIET Marketplace"]],
  ["/import/marketplaces", ["Import & Redeem", "Marketplaces"]],
  ["/import/free-books", ["Import & Redeem", "Free books"]],
  ["/library", ["Lenny Library"]],
  ["/loans", ["Active Loans"]],
  ["/settings", ["Settings"]],
  ["/settings/app-access", ["Settings", "App Access"]],
  ["/settings/external-auth", ["Settings", "Patron Sign-in Provider"]],
  ["/settings/lending-mode", ["Settings", "Lending Mode Configuration"]],
  ["/settings/loan-limits", ["Settings", "Loan Limits"]],
  ["/settings/openlibrary", ["Settings", "OpenLibrary"]],
])("%s", (path, expected) => expect(labels(path)).toEqual(expected))

it("links each level to its own path", () => {
  expect(crumbsFor("/import/upload").map((c) => c.href)).toEqual(["/import", "/import/upload"])
})

it("falls back to a readable title for a page it does not know", () => {
  expect(labels("/settings/new-thing")).toEqual(["Settings", "New thing"])
})

it("has nothing for the root", () => {
  expect(crumbsFor("/")).toEqual([])
})
