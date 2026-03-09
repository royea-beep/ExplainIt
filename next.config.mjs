/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@royea/shared-utils', '@royea/flush-queue', '@royea/prompt-guard'],
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'playwright'],
  },
};

export default nextConfig;
