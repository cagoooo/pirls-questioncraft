
import type { Metadata } from 'next';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { VersionUpdateBanner } from "@/components/VersionUpdateBanner"

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const siteTitle = 'PIRLS閱讀理解生成站 PRO';
const siteDescription = '上傳圖片或直接貼上截圖，APP 為您分析內容並設計PIRLS四層次選擇題。支援圖片貼上、PDF及Excel匯出。專為教育工作者設計的AI輔助工具。';

// GitHub Pages 子路徑（如 /pirls-questioncraft）；自訂網域時設成空字串。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// metadataBase 已含 basePath，OG/Twitter 圖路徑用「相對於 metadataBase」即可，**不要再加 basePath**。
const socialPreviewImageUrl = '/images/social-preview.png';

// link rel=icon 等是直接掛到 site root 的 <link> 標籤，metadataBase 不適用，要手動加 basePath。
const faviconSvgUrl = `${basePath}/icons/favicon.svg`;
const favicon32Url = `${basePath}/icons/favicon-32.png`;
const appleTouchIconUrl = `${basePath}/icons/apple-touch-icon.png`;

// 站點正式網址；可用 NEXT_PUBLIC_SITE_URL 覆蓋
const productionDomain =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (basePath ? `https://cagoooo.github.io${basePath}` : 'https://pirlss.smes.tyc.edu.tw');

export const metadata: Metadata = {
  // metadataBase 會為所有相對路徑 (如 socialPreviewImageUrl 和 icons.icon) 提供基礎 URL
  // 這對於社群媒體爬蟲和某些情況下的 favicon 解析至關重要
  metadataBase: new URL(productionDomain),
  title: siteTitle,
  description: siteDescription,
  icons: {
    icon: [
      { url: faviconSvgUrl, type: 'image/svg+xml' },
      { url: favicon32Url, sizes: '32x32', type: 'image/png' },
    ],
    apple: appleTouchIconUrl,
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

// App 內建瀏覽器防護（標準程式碼，一字不改；見 skill inapp-browser-oauth-escape）
// 用 String.raw 保留  \/ ' 等反斜線
const IN_APP_BROWSER_GUARD = String.raw`
        (function () {
            var ua = navigator.userAgent || "";
            var isLine = /\bLine\//i.test(ua);
            var isOtherInApp = /FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|KAKAOTALK/i.test(ua);
            var isAndroid = /Android/i.test(ua);

            if (isLine && location.search.indexOf("openExternalBrowser=1") === -1) {
                // LINE 官方參數：自動改用外部瀏覽器重開本頁（保留原有 query 與 hash）
                var sep = location.search ? "&" : "?";
                location.replace(location.href.split("#")[0] + sep + "openExternalBrowser=1" + location.hash);
                return;
            }
            if (!isOtherInApp && !isLine) return;

            // Android：用 intent:// 指定 Chrome 開啟本頁（保留 query 與 hash）。
            // 沒裝 Chrome 時改回內建瀏覽器開「帶 iabEscape=1 的本頁」，不再重試，避免無限跳轉。
            var chromeIntent = "";
            if (isAndroid) {
                var fallback = location.href.split("#")[0]
                    + (location.search ? "&" : "?") + "iabEscape=1" + location.hash;
                chromeIntent = "intent://" + location.host + location.pathname + location.search + location.hash
                    + "#Intent;scheme=" + location.protocol.replace(":", "")
                    + ";package=com.android.chrome"
                    + ";S.browser_fallback_url=" + encodeURIComponent(fallback) + ";end";
            }
            var autoJump = false;
            if (chromeIntent) {
                autoJump = location.search.indexOf("iabEscape=1") === -1;
                try { autoJump = autoJump && sessionStorage.getItem("iabEscapeTried") !== "1"; } catch (e) { }
            }

            // 自動跳轉沒生效（舊版 App、沒裝 Chrome、iPhone）→ 顯示全版引導，避免使用者白撞 Google 封鎖
            document.addEventListener("DOMContentLoaded", function () {
                var d = document.createElement("div");
                d.id = "inapp-browser-guide";
                d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,'Microsoft JhengHei',sans-serif;";
                var chromeBtn = chromeIntent
                    ? '<a id="inapp-open-chrome" href="' + chromeIntent.replace(/"/g, "&quot;") + '" style="display:block;margin:22px 0 4px;padding:14px 18px;border-radius:999px;background:#22c55e;color:#052e16;font-size:17px;font-weight:800;text-decoration:none;">用 Chrome 開啟</a>'
                        + '<p style="font-size:13px;color:#94a3b8;margin:8px 0 18px;">按了沒反應，再照下面的方法</p>'
                    : "";
                d.innerHTML = '<div style="max-width:420px;width:100%;box-sizing:border-box;text-align:center;background:#1e293b;border-radius:16px;padding:32px 26px;">'
                    + '<div style="font-size:52px;">🌐</div>'
                    + '<h4 style="font-weight:800;margin:14px 0 10px;">請改用瀏覽器開啟</h4>'
                    + '<p style="font-size:15px;line-height:1.8;color:#cbd5e1;margin:0;">您目前在 <b style="color:#fbbf24;">App 內建瀏覽器</b>（LINE／FB 等）中開啟本頁，Google 基於安全政策<b>禁止在此環境登入</b>。</p>'
                    + chromeBtn
                    + '<p style="font-size:15px;line-height:1.8;color:#cbd5e1;margin:' + (chromeIntent ? "0" : "14px 0 0") + ';">請點右上／右下角「<b>⋯</b>」→ 選「<b style="color:#4ade80;">用預設瀏覽器開啟</b>」。<br><br>💡 也可以把本站「加入主畫面」，之後從桌面圖示開啟最穩定。</p>'
                    + '<button type="button" id="inapp-guide-dismiss" onclick="this.parentNode.parentNode.remove()" style="margin-top:18px;background:transparent;border:1px solid #475569;color:#cbd5e1;border-radius:999px;padding:10px 18px;font-size:14px;">先不登入，繼續瀏覽</button>'
                    + '</div>';
                document.body.appendChild(d);
                // 先把引導畫出來再自動叫 Chrome：就算跳轉被 App 擋下，畫面也不會停在空白
                if (autoJump) {
                    try { sessionStorage.setItem("iabEscapeTried", "1"); } catch (e) { }
                    setTimeout(function () { location.href = chromeIntent; }, 300);
                }
            });
        })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <head>
        {/* 🛡️ App 內建瀏覽器防護：Google 登入在 LINE／FB 內建瀏覽器會被擋（403 disallowed_useragent） */}
        <script dangerouslySetInnerHTML={{ __html: IN_APP_BROWSER_GUARD }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
        {/* B.18: SW 自動更新版本機制 */}
        <VersionUpdateBanner />
        {/* B.4: Cloudflare Turnstile widget script
            - render=explicit: 不要自動掃描 .cf-turnstile，由 TurnstileGate 元件用 turnstile.render() 主動掛載
            - beforeInteractive: 在 React 元件 mount 前載入，避免時序競態
        */}
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
