import { Geist, Geist_Mono } from "next/font/google"
import type { Metadata, Viewport } from "next"

import "@workspace/ui/globals.css"
import { Providers } from "@/components/providers"

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Lenny App",
  description: "Lenny Admin Application",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/lenny-transparent.png" },
      { url: "/lenny-transparent.png", sizes: "32x32", type: "image/png" },
      { url: "/lenny-transparent.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/lenny-transparent.png",
    shortcut: "/lenny-transparent.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lenny",
  },
}

export const viewport: Viewport = {
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased `}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
