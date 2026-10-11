import { redirect } from "next/navigation"

// The old Uploads page (queue + attach) was replaced by the Import page.
export default function Home() {
  redirect("/import")
}
