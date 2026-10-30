import type { NextConfig } from 'next';
import { buildSecurityHeaders } from './src/server/securityHeaders';

const nextConfig: NextConfig = {
  // Container builds set NEXT_OUTPUT=standalone for a minimal runtime image (see Dockerfile).
  // Left off locally because standalone tracing needs symlink rights on Windows.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;

