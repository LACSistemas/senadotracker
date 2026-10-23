import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Permite validar em outro diretório sem tocar o .next do servidor em uso (NEXT_DIST_DIR=.next-ux).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.camara.leg.br', pathname: '/internet/deputado/bandep/**' },
      { protocol: 'http', hostname: 'www.senado.leg.br', pathname: '/senadores/img/fotos-oficiais/**' },
      { protocol: 'https', hostname: 'www.senado.leg.br', pathname: '/senadores/img/fotos-oficiais/**' },
    ],
  },
};

export default nextConfig;

