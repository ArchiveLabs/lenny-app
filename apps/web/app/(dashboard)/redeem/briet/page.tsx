import { redirect } from "next/navigation"

// Redeem now lives on the Import page.
export default function RedeemRedirect() {
  redirect("/import?tab=redeem")
}
