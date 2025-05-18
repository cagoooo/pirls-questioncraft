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
const siteDescription = '上傳圖片，APP 為您分析內容並設計PIRLS四層次選擇題。支援圖片貼上、PDF及Excel匯出。';
// 建議在 public/images/ 建立一張名為 social-preview.png 的圖片 (推薦尺寸 1200x630)
const socialPreviewImageUrl = '/images/social-preview.png'; 

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: 'website',
    // url: '您的網站部署後的完整URL', // 可選，通常平台會自動抓取
    images: [
      {
        url: socialPreviewImageUrl,
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
    images: [socialPreviewImageUrl],
    // site: '@您的Twitter帳號', // 可選
    // creator: '@您的Twitter帳號', // 可選
  },
  // 為了更好的搜尋引擎索引和可訪問性，可以加入其他標籤
  // keywords: ['PIRLS', '閱讀素養', '題目生成', '教育科技', 'AI輔助教學'], // 可選
  // authors: [{ name: '桃園市石門國小資訊組 阿凱老師', url: 'https://www.smes.tyc.edu.tw/' }], // 可選
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
