import { Blobatar } from "@blobatar/react"

// Drawn in the browser from the username: nothing is sent to blobatar.dev, and email is never the seed.
export function UserAvatar({ username, size = 36 }: { username: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 overflow-hidden rounded-lg" style={{ width: size, height: size }}>
      <Blobatar name={username || "admin"} size={size} title="" />
    </span>
  )
}
