import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["@prisma/client", "sharp", "puppeteer-core", "@sparticuz/chromium"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  outputFileTracingIncludes: {
    "/**": [
      "./src/assets/fonts/**",
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/.prisma/client/**",
      "./node_modules/@prisma/client/**",
    ],
  },
  async redirects() {
    return [
      { source: "/complete-life-reading/new", destination: "/new", permanent: false },
      { source: "/complete-life-reading/onboarding", destination: "/onboarding", permanent: false },
      { source: "/complete-life-reading/palmistry", destination: "/palmistry", permanent: false },
      { source: "/complete-life-reading/numerology", destination: "/numerology", permanent: false },
      { source: "/complete-life-reading/astrology", destination: "/astrology", permanent: false },
      { source: "/complete-life-reading/review", destination: "/review", permanent: false },
      { source: "/complete-life-reading/history", destination: "/history", permanent: false },
      { source: "/complete-life-reading/settings", destination: "/settings", permanent: false },
      { source: "/complete-life-reading/processing/:id", destination: "/processing/:id", permanent: false },
      { source: "/complete-life-reading/report/:id", destination: "/report/:id", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
