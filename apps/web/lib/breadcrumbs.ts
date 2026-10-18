import { ACCOUNT, TEAM } from "@/lib/accounts"
import { APP_ACCESS, SIGN_IN_PROVIDER } from "@/lib/app-access"

export interface Crumb {
  label: string
  href: string
}

// One entry per page, keyed by path without the /admin base path. Labels are the pages' own headings.
const TITLES: Record<string, string> = {
  "/import": "Import & Redeem",
  "/import/upload": "Upload Files from Computer",
  "/import/briet": "Redeem from BRIET Marketplace",
  "/import/marketplaces": "Marketplaces",
  "/import/free-books": "Free books",
  "/library": "Lenny Library",
  "/loans": "Active Loans",
  "/settings": "Settings",
  [ACCOUNT.route]: ACCOUNT.title,
  [TEAM.route]: TEAM.title,
  [APP_ACCESS.route]: APP_ACCESS.title,
  [SIGN_IN_PROVIDER.route]: SIGN_IN_PROVIDER.title,
  "/settings/lending-mode": "Lending Mode Configuration",
  "/settings/loan-limits": "Loan Limits",
  "/settings/openlibrary": "OpenLibrary",
}

const titleCase = (segment: string) => segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())

/** Every level from the section down to this page: /import/upload gives Import & Redeem, then Upload Files from Computer. */
export function crumbsFor(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean)
  return parts.map((_, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/")
    return { href, label: TITLES[href] ?? titleCase(parts[i]!) }
  })
}
