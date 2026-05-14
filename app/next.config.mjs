
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // Privy SDK optionally imports @farcaster/mini-app-solana for Farcaster Mini
    // App support. We don't use that feature, so stub it out to avoid a missing-
    // module build error.
    config.resolve.alias['@farcaster/mini-app-solana'] = false;
    return config;
  },
};

export default nextConfig;
