import { redirect } from "next/navigation"

// Redeem now lives on the Import & Redeem page.
export default function RedeemRedirect() {
  redirect("/import")
}
