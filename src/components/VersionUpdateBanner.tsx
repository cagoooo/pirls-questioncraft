"use client";

// B.18: SW + version.json 自動更新提示
// 兩個機制並聯：
//  1. 註冊 sw.js，監聽 'controllerchange' → 換新版時立刻 reload（第一次進站與學生作答頁除外）
//  2. 每 5 分鐘 fetch version.json 比對，發現新版彈 toast banner 讓使用者主動點（學生作答中不彈，結束後才出現）

import { useEffect, useState } from 'react';
import { Spark } from '@/components/Neo';
import { cn } from '@/lib/utils';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { isQuizAnswering, onQuizAnsweringChange } from '@/lib/quizSession';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘
const VERSION_URL =
  (process.env.NEXT_PUBLIC_BASE_PATH ?? '') + '/version.json';
const SW_URL = (process.env.NEXT_PUBLIC_BASE_PATH ?? '') + '/sw.js';
const SW_SCOPE = (process.env.NEXT_PUBLIC_BASE_PATH ?? '') + '/';

interface VersionInfo {
  version: string;
  sha?: string;
  builtAt?: string;
}

/** 20261120-0712cd2 → { label: '11/20 更新', sha: '0712cd2' }；看不懂的格式就原樣顯示 */
function prettyVersion(v: string): { label: string; sha?: string } {
  const m = /^(\d{4})(\d{2})(\d{2})-(\w+)$/.exec(v);
  if (!m) return { label: v };
  return { label: `${Number(m[2])}/${Number(m[3])} 更新`, sha: m[4] };
}

export function VersionUpdateBanner() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // 學生作答中先不跳提示：按「立即更新」會重新載入頁面，等測驗結束再出現
  const [quizAnswering, setQuizAnsweringState] = useState(false);
  useEffect(() => {
    setQuizAnsweringState(isQuizAnswering());
    return onQuizAnsweringChange(setQuizAnsweringState);
  }, []);

  // ---- 1. 註冊 Service Worker ----
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // 開發環境下 (localhost) 主動解除註冊所有現存的 Service Worker，避免 HMR 衝突
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      return;
    }

    let ignored = false;
    // 開頁時已經有舊版 SW 在管這一頁 → 之後換手才是「換新版」；
    // 沒有的話是第一次進站，SW 只是第一次接手，不需要重新整理（否則學生剛填的姓名會不見）
    let hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker
      .register(SW_URL, { scope: SW_SCOPE })
      .then((reg) => {
        if (ignored) return;
        // 嘗試偵測有 waiting 的新 SW
        if (reg.waiting && navigator.serviceWorker.controller) {
          reg.waiting.postMessage('SKIP_WAITING');
        }
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // 新 SW 已 install + 已有舊 controller → 通知它 skipWaiting
              installing.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[SW] register failed:', err?.message);
      });

    // SW 換手時自動 reload（清乾淨拿到新 chunks）
    // 例外：第一次進站不 reload；學生作答頁（/quiz）也不自動 reload，免得作答到一半全部消失，改由下方「有新版本」提示讓使用者自己按
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      if (!hadController) {
        // 第一次接手：記下來，之後同一頁再換手才算換新版
        hadController = true;
        return;
      }
      if (/\/quiz\/?$/.test(window.location.pathname)) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      ignored = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  // ---- 2. 每 5 分鐘比對 version.json ----
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const fetchVersion = async (): Promise<VersionInfo | null> => {
      try {
        const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return null;
        return (await res.json()) as VersionInfo;
      } catch {
        return null;
      }
    };

    const check = async () => {
      const v = await fetchVersion();
      if (cancelled || !v) return;
      if (currentVersion === null) {
        setCurrentVersion(v.version);
      } else if (v.version !== currentVersion) {
        setLatestVersion(v.version);
      }
    };

    // 啟動立刻撈一次（建立 baseline），之後固定間隔
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);

    // 從另一個分頁切回來時也檢查一次（很多人會切走再切回）
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentVersion]);

  if (!latestVersion || dismissed || quizAnswering) return null;

  const handleUpdate = async () => {
    // 清掉本工具自己的 SW caches → reload
    // （同網域 cagoooo.github.io 的其他工具快取不能動，只刪 pirls-static-* / pirls-html-*）
    if ('caches' in window) {
      try {
        const isOwnCache = (k: string) =>
          k.startsWith('pirls-static-') || k.startsWith('pirls-html-');
        const keys = await caches.keys();
        await Promise.all(keys.filter(isOwnCache).map((k) => caches.delete(k)));
      } catch {}
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      reg?.waiting?.postMessage('SKIP_WAITING');
    }
    window.location.reload();
  };

  const pretty = prettyVersion(latestVersion);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed z-[100] left-4 right-4 bottom-4 sm:right-auto sm:left-6 sm:bottom-6 sm:w-[25rem]',
        'motion-safe:animate-in motion-safe:slide-in-from-bottom-6 motion-safe:fade-in motion-safe:duration-300'
      )}
    >
      <div
        className="relative bg-card text-ink border-neo rounded-[22px] p-4 sm:p-5"
        style={{ boxShadow: '0 6px 0 hsl(var(--border)), 0 22px 44px -14px rgba(61, 46, 30, 0.45)' }}
      >
        {/* 角落貼紙 */}
        <span
          aria-hidden
          className="absolute -top-3 left-6 rotate-[-4deg] bg-coral text-white border-neo rounded-full px-2.5 py-0.5 text-xs font-extrabold tracking-wider shadow-neo-sm"
        >
          NEW
        </span>
        <Spark size={14} color="#F2C14E" className="absolute top-3 right-12 opacity-90" />

        <div className="flex items-start gap-3.5">
          <div className="shrink-0 w-12 h-12 rounded-2xl bg-lemon border-neo shadow-neo-sm flex items-center justify-center -rotate-3">
            <Sparkles className="h-6 w-6" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-lg font-extrabold leading-tight">有新版本可以用了！</p>
            <p className="text-sm text-ink/75 mt-1 leading-snug">
              重新整理一下就是最新版。正在輸入的文章請先存好再更新。
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-cream border-[1.5px] border-ink px-2.5 py-0.5 text-xs font-bold">
              <span>🆕 {pretty.label}</span>
              {pretty.sha && <span className="font-mono text-ink/60">{pretty.sha}</span>}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 -mr-1 -mt-1 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-deep transition-colors"
            aria-label="關閉更新提示"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2.5 mt-4">
          <button
            onClick={handleUpdate}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-coral text-white border-neo rounded-full px-4 py-2.5 text-base font-extrabold shadow-neo-sm neo-press hover:-translate-y-px hover:shadow-neo transition-all"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2.6} />
            立即更新
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="inline-flex items-center justify-center bg-card text-ink border-neo rounded-full px-5 py-2.5 text-base font-bold shadow-neo-sm neo-press hover:-translate-y-px hover:shadow-neo transition-all"
          >
            稍後
          </button>
        </div>
      </div>
    </div>
  );
}
