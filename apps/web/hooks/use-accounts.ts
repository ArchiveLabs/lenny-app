import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { fetchAdmin, handleApiResponse, redirectToLogin } from "@/lib/api-client"
import { ApiError, Librarian, LibrarianList, LibrarianListSchema, LibrarianSchema } from "@/types/api"

export const ME_KEY = ["admin-me"]
export const LIBRARIANS_KEY = ["librarians"]

// A 401/403 answer won't change by asking again; only retry network/server failures.
const retry = (count: number, e: unknown) => !(e instanceof ApiError && e.status !== undefined && e.status < 500) && count < 2

export function useMe() {
    return useQuery({
        queryKey: ME_KEY,
        retry,
        queryFn: async () => handleApiResponse<Librarian>(await fetchAdmin("me"), LibrarianSchema),
    })
}

export function useLibrarians(enabled: boolean) {
    return useQuery({
        queryKey: LIBRARIANS_KEY,
        retry,
        enabled,
        queryFn: async () => handleApiResponse<LibrarianList>(await fetchAdmin("librarians"), LibrarianListSchema),
    })
}

const send = (path: string, method: string, body: unknown) =>
    fetchAdmin(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((res) => handleApiResponse<Librarian>(res, LibrarianSchema))

export const updateLibrarian = (id: number, body: { name?: string; email?: string; password?: string; current_password?: string; is_super?: boolean }) =>
    send(`librarians/${id}`, "PUT", body)

export const createLibrarian = (body: { name: string; email: string; password: string }) =>
    send("librarians", "POST", body)

export const setDisabled = (id: number, disabled: boolean) => send(`librarians/${id}/disable`, "POST", { disabled })

// Failed-request wording: an expired session goes to the login page, anything else becomes a toast.
export function useFailure() {
    return (e: unknown) => {
        if (e instanceof ApiError && e.status === 401) return void redirectToLogin()
        toast.error(e instanceof ApiError ? e.message : "Can't reach the server. Check your connection and try again.")
    }
}
