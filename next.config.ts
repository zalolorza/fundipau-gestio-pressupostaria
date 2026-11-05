import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      { source: "/clients", destination: "/financadors", permanent: true },
      { source: "/clients/:id", destination: "/financadors/:id", permanent: true },
    ]
  },
};

export default nextConfig;
