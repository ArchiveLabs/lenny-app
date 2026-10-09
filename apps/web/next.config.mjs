/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  basePath: '/admin',
  experimental: {
    middlewareClientMaxBodySize: '100mb', // match lenny api MAX_FILE_SIZE
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // No framing (clickjacking), no MIME sniffing, no referrer leakage, no powerful APIs.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
