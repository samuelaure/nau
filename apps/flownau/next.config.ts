import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', 'sharp'],
}

export default nextConfig
