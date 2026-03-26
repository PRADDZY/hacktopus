/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async redirects() {
    return [
      { source: '/', destination: '/shop', permanent: false },
      { source: '/product/:path*', destination: '/shop', permanent: false },
      { source: '/cart', destination: '/shop', permanent: false },
      { source: '/orders', destination: '/shop', permanent: false },
      { source: '/wishlist', destination: '/shop', permanent: false },
      { source: '/profile', destination: '/shop', permanent: false },
      { source: '/support', destination: '/shop', permanent: false },
      { source: '/signup', destination: '/login', permanent: false },
      { source: '/admin/:path*', destination: '/login?role=admin', permanent: false },
      { source: '/dashboard/analytics', destination: '/dashboard', permanent: false },
      { source: '/dashboard/emi-requests', destination: '/dashboard', permanent: false },
      { source: '/dashboard/audit-logs', destination: '/dashboard', permanent: false },
    ];
  },
};

module.exports = nextConfig;

if (process.env.NODE_ENV === 'development') {
  const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare');
  initOpenNextCloudflareForDev();
}
