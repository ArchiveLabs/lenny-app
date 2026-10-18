import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { EmailPrompt } from "@/components/email-prompt"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  if (!cookieStore.get("admin_token")) {
    redirect("/login") // redirect() adds the /admin basePath itself
  }
  return (
    <SidebarProvider
      // A slimmer top bar on phones; the full one from sm up.
      className="[--header-height:calc(var(--spacing)*10)] sm:[--header-height:calc(var(--spacing)*12)]"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <EmailPrompt />
      <SidebarInset className="min-w-0">
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-(--content-max) min-w-0 flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:gap-6 md:p-6 lg:p-12">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
