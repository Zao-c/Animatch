/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.bgm.tv"
      },
      {
        protocol: "https",
        hostname: "**.bangumi.tv"
      }
    ]
  }
};

export default nextConfig;
