import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['node:sqlite'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.camara.leg.br', pathname: '/internet/deputado/bandep/**' },
      { protocol: 'http', hostname: 'www.senado.leg.br', pathname: '/senadores/img/fotos-oficiais/**' },
      { protocol: 'https', hostname: 'www.senado.leg.br', pathname: '/senadores/img/fotos-oficiais/**' },
    ],
  },
};

export default nextConfig;
