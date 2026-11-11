import type { NextConfig } from 'next';

/**
 * The hosts this deployment answers on, so an image already stored as a full
 * URL back to our own site still optimises.
 *
 * New entries are reduced to a relative path when they are saved, which needs
 * no configuration and survives a change of domain. This covers what was
 * stored before that, and anything pasted from a preview deployment. The
 * pathname is pinned to the media route so this cannot become a general
 * purpose proxy for the whole site.
 */
function ownHosts(): { protocol: 'https'; hostname: string; pathname: string }[] {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ];

  const hostnames = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const { hostname, protocol } = new URL(candidate);
      // Only https: the optimiser would refuse a local http host anyway, and
      // a relative path covers development.
      if (protocol === 'https:') hostnames.add(hostname);
    } catch {
      // A malformed value must not take the build down.
    }
  }

  return [...hostnames].map((hostname) => ({
    protocol: 'https' as const,
    hostname,
    pathname: '/api/media/**',
  }));
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Next blocks dev-only resources requested from an origin other than the one
   * the server reports, which silently breaks hot reload and hydration. These
   * are the hosts the same machine and the local network legitimately use, for
   * example when checking a page on a phone.
   */
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.*.*', '10.*.*.*'],
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      ...ownHosts(),
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1536, 1920],
  },
  serverExternalPackages: ['pg', '@react-pdf/renderer'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
