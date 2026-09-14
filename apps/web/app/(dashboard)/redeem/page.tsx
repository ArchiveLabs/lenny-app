import Link from "next/link"
import { ChevronRight, Ticket } from "lucide-react"

interface RedeemSource {
  slug: string
  name: string
  description: string
  icon: React.ElementType
  logoUrl?: string
}

// New sources get added here — the list page and nav tab don't need to change.
const SOURCES: RedeemSource[] = [
  {
    slug: "briet",
    name: "BRIET",
    description: "Redeem a BRIET bundle code to import every book it contains.",
    icon: Ticket,
    logoUrl: "/admin/briet-logo.svg",
  },
]

export default function RedeemPage() {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 space-y-10 p-2 md:p-6 lg:p-8">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Redeem</h2>
        <p className="text-muted-foreground text-base max-w-2xl">
          Choose a source to redeem a bundle or code from.
        </p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm divide-y max-w-2xl overflow-hidden">
        {SOURCES.map((source) => (
          <Link
            key={source.slug}
            href={`/redeem/${source.slug}`}
            className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
              {source.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={source.logoUrl} alt={`${source.name} logo`} className="h-6 w-6 object-contain" />
              ) : (
                <source.icon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{source.name}</p>
              <p className="text-sm text-muted-foreground truncate">{source.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
