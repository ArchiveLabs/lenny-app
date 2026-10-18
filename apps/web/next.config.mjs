const isProd = process.env.NODE_ENV === 'production'

// The API origin the browser talks to directly (public catalog reads).
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').origin
  } catch {
    return "'self'"
  }
})()

// What the admin actually loads, written down tight. Report-Only for now: it logs violations to the
// browser console without blocking anything, so click through every page, then rename the header
// below to Content-Security-Policy to enforce it. script-src still needs 'unsafe-inline' for Next's
// own bootstrap scripts; dropping it means serving a per-request nonce from proxy.ts.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://covers.openlibrary.org ${apiOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  basePath: '/admin',
  poweredByHeader: false, // don't announce the framework
  experimental: {
    proxyClientMaxBodySize: '100mb', // match lenny api MAX_FILE_SIZE
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // No framing (clickjacking), no MIME sniffing, no referrer leakage, no powerful APIs.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Browsers ignore this over plain http, so it only bites once the admin is served over https.
          ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
        ],
      },
    ]
  },
}

export default nextConfig
