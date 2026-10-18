import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { safeNextPath } from "@/lib/safe-url"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  // Server-side guard: already authenticated → go home
  const cookieStore = await cookies()
  if (cookieStore.get("admin_token")) {
    redirect("/")
  }

  const { next } = await searchParams
  const nextPath = safeNextPath(next)

  return (
    <div className="grid min-h-svh w-full lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(255_255_255/0.18),transparent_55%),radial-gradient(circle_at_85%_90%,rgb(0_0_0/0.25),transparent_50%)]" />
        <div className="relative flex items-center gap-3 text-lg font-semibold">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/90 p-1.5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/admin/lenny-transparent.png" alt="" className="size-full object-contain" />
          </span>
          Lenny
        </div>
        <div className="relative max-w-md space-y-3">
          <p className="text-3xl font-semibold leading-tight tracking-tight">Your library, in your hands.</p>
          <p className="text-base text-primary-foreground/80">Add books, manage who borrows them and keep the shelves in order.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center bg-background p-6 md:p-10">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <LoginForm redirectTo={nextPath} />
        </div>
      </main>
    </div>
  )
}
