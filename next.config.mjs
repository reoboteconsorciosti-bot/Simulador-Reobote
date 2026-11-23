/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  // Chromium da geração de PDF não pode ser empacotado pelo bundler.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // Garante que os templates HTML vão junto no build standalone/Vercel.
  outputFileTracingIncludes: {
    '/api/proposal/pdf': ['./designerProposta/**/*'],
  },
}

export default nextConfig
