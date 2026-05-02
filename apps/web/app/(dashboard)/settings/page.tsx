import Link from "next/link"
import { ChevronRight, BookOpen, Settings2 } from "lucide-react"
import { Separator } from "@workspace/ui/components/separator"

const integrations = [
  {
    href: "/settings/openlibrary",
    icon: BookOpen,
    title: "Sign in with OpenLibrary Account",
    description: "Connect your OpenLibrary account to enable lending",
  },
]

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your Lenny instance configuration.</p>
      </div>

      {/* Integrations */}
      <section className="space-y-1">
        <div className="flex items-center gap-2 px-1 mb-3">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Integrations</span>
        </div>

        <div className="rounded-lg border divide-y overflow-hidden">
          {integrations.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 px-4 py-4 bg-background hover:bg-accent/50 transition-colors group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-muted-foreground truncate">{description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
