import { Blobatar } from "@blobatar/react"

// Drawn in the browser, so nothing is sent to blobatar.dev. Seed it with something that doesn't change when a name does.
export function UserAvatar({ seed, size = 36 }: { seed: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 overflow-hidden rounded-lg" style={{ width: size, height: size }}>
      <Blobatar name={seed || "admin"} size={size} title="" />
    </span>
  )
}
