"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchAdmin, handleApiResponse } from "@/lib/api-client"
import { GhostSettings, GhostSettingsSchema } from "@/types/api"

export const GHOST_SETTINGS_KEY = ["ghost-settings"]

/** The Ghost settings. Shared by the settings page, the sidebar and the stats page; an older server answers 404. */
export function useGhostSettings() {
  return useQuery({
    queryKey: GHOST_SETTINGS_KEY,
    queryFn: async () => handleApiResponse<GhostSettings>(await fetchAdmin("settings/ghost"), GhostSettingsSchema),
    retry: false,
  })
}
