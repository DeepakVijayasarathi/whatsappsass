/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // Proxy /api/* → backend using server-side BACKEND_URL (never exposed to browser)
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
