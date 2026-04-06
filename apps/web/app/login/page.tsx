import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/login-form"

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
  const nextPath =
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\")
      ? next
      : "/"

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6 md:p-10">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-6 duration-700">
        <LoginForm redirectTo={nextPath} />
      </div>
    </div>
  )
}
