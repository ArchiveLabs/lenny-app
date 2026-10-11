import type { Source } from "./SourceList"

// New marketplaces get added here; the hub and the marketplaces page both read it.
export const MARKETPLACES: Source[] = [
  {
    title: "BRIET Marketplace",
    description: "Redeem a BRIET bundle code to import every book it contains.",
    href: "/import/briet",
    // eslint-disable-next-line @next/next/no-img-element
    icon: <img src="/admin/briet-logo.svg" alt="" className="h-full w-full object-contain" />,
  },
]
