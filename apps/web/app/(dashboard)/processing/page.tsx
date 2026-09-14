import { redirect } from "next/navigation"

export default function ProcessingRedirect() {
  redirect("/?tab=processing")
}
