const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  webpack: (config) => {
    // WalletConnect pulls in pino which optionally requires pino-pretty — not needed in browser
    config.resolve.fallback = { ...config.resolve.fallback, 'pino-pretty': false }
    return config
  },
}

module.exports = withNextIntl(nextConfig)
