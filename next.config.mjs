import { withPlausibleProxy } from "next-plausible";

/** @type {import('next').NextConfig} */
const nextConfig = withPlausibleProxy()({
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side fallbacks
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: import.meta.resolve('crypto-browserify'),
        stream: import.meta.resolve('stream-browserify'),
        http: import.meta.resolve('stream-http'),
        https: import.meta.resolve('https-browserify'),
        querystring: import.meta.resolve('querystring-es3'),
        path: import.meta.resolve('path-browserify'),
        fs: false,
        net: false,
        tls: false,
        zlib: false,
      };
    }
    return config;
  },
});

export default nextConfig;
