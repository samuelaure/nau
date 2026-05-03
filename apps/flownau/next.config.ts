import path from 'path'
import type { NextConfig } from 'next'

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
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      '@prisma/client': './node_modules/.prisma/client',
    },
  },
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // pnpm virtual store doesn't expose @swc/helpers at a standard path — force-include it
  // so the standalone tracer bundles it regardless of hoisting layout.
  // Glob is relative to outputFileTracingRoot (monorepo root, two levels up).
  outputFileTracingIncludes: {
    '/**': ['node_modules/.pnpm/@swc+helpers*/node_modules/@swc/helpers/**'],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', 'sharp'],
  transpilePackages: ['nau-storage', 'node-cron', 'bullmq', 'ioredis', 'pino', 'axios'],
}

export default nextConfig
