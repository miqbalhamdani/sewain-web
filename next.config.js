/** @type {import('next').NextConfig} */

const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH,
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH,
  images: {
    unoptimized: true,
  },

  // Tenant hosts in development (S1-060): Next only serves its dev assets to
  // origins it trusts, and <slug>.sewain.localhost behind Caddy is one.
  allowedDevOrigins: ['*.sewain.localhost'],

  // The API is same-origin by contract: the client asks for `/api/v1/...` and
  // never for a host. In production Caddy routes that to the Go service
  // (S1-073); locally there is no proxy, so Next does the same job.
  //
  // This is not an escape hatch for a NEXT_PUBLIC_API_URL constant -- the rule
  // is that the base URL is the origin being served, and it still is. What
  // changes is only who forwards the request.
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_ORIGIN ?? 'http://localhost:8080'}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
