import { redirect } from "next/navigation"
import { APP_ACCESS } from "@/lib/app-access"

// Renamed to App Access; keep old links working.
export default function Redirect() {
    redirect(APP_ACCESS.route)
}
