import type { NextConfig } from 'next';

// 路線 B：GitHub Pages（純靜態）+ Firebase Cloud Functions（後端）
// - output: 'export' → next build 後產生 out/，可丟給 GitHub Pages
// - basePath / assetPrefix → 配合 cagoooo.github.io/pirls-questioncraft 子路徑
//   未來掛自訂網域（如 pirlss.smes.tyc.edu.tw）後，把這兩個改成空字串即可
// - images.unoptimized → static export 不能用 next/image 的 server optimizer

const isProd = process.env.NODE_ENV === 'production';
// 若部署到自訂網域（CNAME），把 NEXT_PUBLIC_BASE_PATH 設成空字串即可關掉子路徑
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (isProd ? '/pirls-questioncraft' : '');

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  env: {
    // 暴露給 client 端讀取，組分享連結用
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
