/** @type {import('next').NextConfig} */
const nextConfig = {
  // Les images produits du seed pointent vers des domaines externes (placeholders).
  // On autorise tout host distant en https pour le MVP (à restreindre en prod).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
