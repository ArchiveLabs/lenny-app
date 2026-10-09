import { useQuery } from "@tanstack/react-query"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { ApiError, OAuth2ClientList, OAuth2ClientListSchema } from "@/types/api"

export const OAUTH2_CLIENTS_KEY = ["oauth2-clients"]

export function useOAuth2Clients() {
    return useQuery({
        queryKey: OAUTH2_CLIENTS_KEY,
        // A 401/403/404 answer won't change by asking again; only retry network/server failures.
        retry: (count, e) => !(e instanceof ApiError && e.status !== undefined && e.status < 500) && count < 2,
        queryFn: async () =>
            handleApiResponse<OAuth2ClientList>(await fetchAdmin("oauth2/clients"), OAuth2ClientListSchema),
    })
}
