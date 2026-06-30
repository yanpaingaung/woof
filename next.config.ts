import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.192", "localhost", "*.ngrok-free.app", "*.ngrok.io"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "wooftranslator-yike.vercel.app" }],
        destination: "https://wooftranslator.vercel.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
