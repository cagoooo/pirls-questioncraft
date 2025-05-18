
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const siteTitle = 'PIRLS 閱讀素養題組生成站';
const siteDescription = '上傳圖片或直接貼上截圖，APP 為您分析內容並設計PIRLS四層次選擇題。支援圖片貼上、PDF及Excel匯出。專為教育工作者設計的AI輔助工具。';
// 建議在 public/images/ 建立一張名為 social-preview.png 的圖片 (推薦尺寸 1200x630)
const socialPreviewImageUrl = '/images/social-preview.png'; 

// !!! 重要：請將下面的 'https://your-production-domain.com' 替換成您網站的實際生產環境域名 !!!
const productionDomain = 'https://pirlss.smes.tyc.edu.tw'; // 例如：https://www.example.com

export const metadata: Metadata = {
  // metadataBase 會為所有相對路徑 (如 socialPreviewImageUrl 和 icons.icon) 提供基礎 URL
  // 這對於社群媒體爬蟲和某些情況下的 favicon 解析至關重要
  metadataBase: new URL(productionDomain),
  title: siteTitle,
  description: siteDescription,
  icons: {
    icon: '/images/logo.png', // Sets the favicon to use logo.png from public/images
    // apple: '/images/apple-icon.png', // You can add other icon types if needed
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: 'website',
    // url: '您的網站部署後的完整URL', // metadataBase 已設定，此處可選
    images: [
      {
        url: socialPreviewImageUrl, // 現在會是絕對路徑
        width: 1200,
        height: 630,
        alt: siteTitle,
      },
    ],
    siteName: siteTitle,
    locale: 'zh_TW',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: [socialPreviewImageUrl], // 現在會是絕對路徑
    // site: '@您的Twitter帳號', // 可選
    // creator: '@您的Twitter帳號', // 可選
  },
  keywords: ['PIRLS', '閱讀素養', '題目生成', '教育科技', 'AI輔助教學', '繁體中文', '台灣適用', '圖片轉文字', '自動出題'],
  authors: [{ name: '桃園市石門國小資訊組 阿凱老師', url: 'https://www.smes.tyc.edu.tw/' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
