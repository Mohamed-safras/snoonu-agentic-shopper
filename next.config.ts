import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Cloud Run runs the build output directly in a minimal container — the
  // standalone build copies only the files a production server needs (no
  // full node_modules tree), keeping the image small.
  output: "standalone",
  images: {
    // Snoonu is a marketplace: product images come from many third-party shop
    // CDNs (snoonu.com, cdn.shopify.com, …) that we can't enumerate ahead of
    // time. Allow any HTTPS host so next/image can load every catalog image.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
