import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  transpilePackages: ['@9nau/ui'],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@9nau/ui': path.resolve(__dirname, '../../packages/nau-ui/src'),
      '@9nau/ui/lib/utils': path.resolve(__dirname, '../../packages/nau-ui/src/lib/utils'),
      '@9nau/ui/components/button': path.resolve(__dirname, '../../packages/nau-ui/src/components/button'),
      '@9nau/ui/components/card': path.resolve(__dirname, '../../packages/nau-ui/src/components/card'),
      '@9nau/ui/components/input': path.resolve(__dirname, '../../packages/nau-ui/src/components/input'),
    }
    return config
  },
}

export default nextConfig
