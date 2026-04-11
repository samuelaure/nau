import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', 'sharp'],
}

export default nextConfig
