/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  basePath: '/admin',
  experimental: {
    middlewareClientMaxBodySize: '100mb', // match lenny api MAX_FILE_SIZE
  },
}

export default nextConfig
