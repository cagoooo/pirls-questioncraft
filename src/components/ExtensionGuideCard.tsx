// src/components/ExtensionGuideCard.tsx
// v0.4.0：共用出題次數用完時（今天 3 次用完，或開發者本月共用額度池用完），
// 不只顯示錯誤，而是引導老師改用 Chrome 擴充套件（用自己的免費 Gemini 金鑰繼續出題），
// 並請老師到商店給五星好評，讓更多老師知道這個工具。

import Link from 'next/link';
import { cn } from '@/lib/utils';

export const EXTENSION_STORE_URL = 'https://chromewebstore.google.com/detail/cfbehdinangicblpbnockoofeccmoidp';
export const EXTENSION_REVIEW_URL = `${EXTENSION_STORE_URL}/reviews`;

export type QuotaGuideKind = 'daily' | 'pool';

export interface QuotaGuide {
  kind: QuotaGuideKind;
  message: string;
  extensionUrl?: string;
  reviewUrl?: string;
}

/** 後端錯誤代碼 → 引導卡種類；不是額度問題回傳 null */
export function quotaGuideKind(code: unknown): QuotaGuideKind | null {
  if (code === 'quota/pool-exhausted') return 'pool';
  if (code === 'quota/daily-limit') return 'daily';
  return null;
}

/** 只接受 Chrome 商店網址，避免把任意網址放進按鈕 */
function safeStoreUrl(url: string | undefined, fallback: string): string {
  return typeof url === 'string' && url.startsWith('https://chromewebstore.google.com/') ? url : fallback;
}

const btn =
  'inline-flex items-center justify-center gap-2 border-neo rounded-full font-extrabold shadow-neo-sm neo-press ' +
  'hover:-translate-y-px hover:shadow-neo px-5 py-2.5 text-base text-ink no-underline text-center';

export function ExtensionGuideCard({ guide, className }: { guide: QuotaGuide; className?: string }) {
  const storeUrl = safeStoreUrl(guide.extensionUrl, EXTENSION_STORE_URL);
  const reviewUrl = safeStoreUrl(guide.reviewUrl, EXTENSION_REVIEW_URL);
  return (
    <div
      role="alert"
      className={cn('bg-card border-neo rounded-[22px] shadow-neo-lg p-5 sm:p-6 text-ink flex flex-col gap-4', className)}
    >
      <span className="self-start inline-flex items-center gap-1.5 bg-lemon border-neo rounded-full px-3 py-1 text-sm font-extrabold">
        {guide.kind === 'pool' ? '🌙 本月共用額度用完了' : '🔢 今天的共用出題次數用完了'}
      </span>
      <p className="text-lg sm:text-xl font-extrabold leading-snug">
        改用 Chrome 擴充套件「PIRLS 閱讀題組小幫手」，<br className="hidden sm:inline" />
        用你自己的免費 Gemini 金鑰繼續出題 🧩
      </p>
      <p className="text-base leading-relaxed">{guide.message}</p>
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={cn(btn, 'bg-sky')}>
          🧩 免費加到 Chrome
        </a>
        <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className={cn(btn, 'bg-lemon')}>
          ⭐⭐⭐⭐⭐ 給我們五星好評
        </a>
        <Link href="/extension/" className={cn(btn, 'bg-card')}>
          📖 看安裝與金鑰申請說明
        </Link>
      </div>
      <p className="text-sm opacity-80">
        小提醒：裝好後在擴充套件的設定頁貼上自己的 Gemini 金鑰（免費申請，步驟在安裝說明頁），就能在任何網頁截圖或讀全文出題，還能一鍵送到 PaGamO。
      </p>
    </div>
  );
}
