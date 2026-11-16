/** A Ghost tier by its name, or by its ID when Lenny couldn't read the name. */
export const TierName = ({ id, name }: { id: string; name?: string | null }) =>
  name ? <span title={id}>{name}</span> : <span className="font-mono text-xs">{id}</span>
