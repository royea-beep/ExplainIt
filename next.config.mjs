/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@royea/shared-utils', '@royea/flush-queue'],
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'playwright'],
  },
};

export default nextConfig;
