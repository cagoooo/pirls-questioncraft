// src/components/ExtensionGuideCard.tsx
// v0.4.0：共用出題次數用完時（今天 3 次用完，或開發者本月共用額度池用完），
// 不只顯示錯誤，而是引導老師改用 Chrome 擴充套件（用自己的免費 Gemini 金鑰繼續出題），
// 並請老師到商店給五星好評，讓更多老師知道這個工具。
// v0.4.1：每個按鈕記點擊次數（只記次數，不記是誰）；另有筆電寬度的精簡橫幅、剩最後 1 次的提醒。

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { trackGuideClick, type GuideSource } from '@/lib/api';

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

/** 還沒按出題就知道用完時（開頁查詢），前端自己組的說明文字 */
export function localGuideMessage(kind: QuotaGuideKind, limit: number): string {
  return kind === 'pool'
    ? '開發者提供的本月共用額度池已經用完了，下個月 1 日（台北時間）會重新開放。現在可以改用我們開發的 Chrome 擴充套件，用你自己的免費 Gemini 金鑰繼續出題；用得順手的話，也請到商店給我們五星好評 ⭐⭐⭐⭐⭐，讓更多老師知道這個工具！'
    : `你今天的 ${limit} 次共用出題已經用完了，明天（台北時間午夜後）會再給你 ${limit} 次。想現在繼續出題，可以改用我們開發的 Chrome 擴充套件，用你自己的免費 Gemini 金鑰，次數不受限制；用得順手的話，也請到商店給我們五星好評 ⭐⭐⭐⭐⭐，讓更多老師知道這個工具！`;
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
  const source: GuideSource = guide.kind;
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
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={cn(btn, 'bg-sky')}
          onClick={() => trackGuideClick(source, 'store')}>
          🧩 免費加到 Chrome
        </a>
        <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className={cn(btn, 'bg-lemon')}
          onClick={() => trackGuideClick(source, 'review')}>
          ⭐⭐⭐⭐⭐ 給我們五星好評
        </a>
        <Link href="/extension/" className={cn(btn, 'bg-card')} onClick={() => trackGuideClick(source, 'install')}>
          📖 看安裝與金鑰申請說明
        </Link>
      </div>
      <p className="text-sm opacity-80">
        小提醒：擴充套件要用<b>電腦版 Chrome</b> 安裝（手機、平板的 Chrome 不能裝）。裝好後在設定頁貼上自己的 Gemini 金鑰（免費申請，步驟在安裝說明頁），就能在任何網頁截圖或讀全文出題，還能一鍵送到 PaGamO。
      </p>
    </div>
  );
}

/** v0.4.1：今天只剩最後 1 次時，先輕輕提醒有擴充套件可以用（還沒撞牆就讓老師知道） */
export function LastOneHint({ className }: { className?: string }) {
  return (
    <p className={cn('text-base leading-6 px-4 py-3 rounded-[16px] border-[1.5px] border-ink bg-sky/40', className)}>
      ⏳ 今天只剩<b>最後 1 次</b>共用出題囉！想多出幾份，可以改用
      <Link href="/extension/" className="font-extrabold underline underline-offset-2 mx-1" onClick={() => trackGuideClick('last-one', 'install')}>
        Chrome 擴充套件
      </Link>
      ，用自己的免費 Gemini 金鑰，次數不受限制。
    </p>
  );
}

/** v0.4.1：一般筆電寬度（768～1535px）也看得到的精簡擴充套件介紹；手機平板不能裝擴充套件所以不顯示 */
export function ExtensionBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'hidden md:flex 2xl:hidden items-center gap-4 flex-wrap',
        'bg-card border-neo rounded-[20px] shadow-neo px-5 py-4 text-ink',
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5 bg-sky border-neo rounded-full px-3 py-1 text-sm font-extrabold shrink-0">
        🧩 Chrome 擴充套件
      </span>
      <span className="flex-1 min-w-[16rem] text-base leading-6">
        <b>在任何網頁截圖或讀全文，一分鐘變成 PIRLS 題組</b>，還能一鍵送到 PaGamO。用自己的免費 Gemini 金鑰，不受每天 3 次限制。
      </span>
      <span className="flex gap-2 flex-wrap shrink-0">
        <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer"
          className={cn(btn, 'bg-lemon !px-4 !py-2')} onClick={() => trackGuideClick('banner', 'store')}>
          免費加到 Chrome
        </a>
        <Link href="/extension/" className={cn(btn, 'bg-card !px-4 !py-2')} onClick={() => trackGuideClick('banner', 'install')}>
          看說明
        </Link>
      </span>
    </div>
  );
}
