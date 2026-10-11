import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export function BackLink({ label }: { label: string }) {
  return (
    <Link href="/import" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  )
}
