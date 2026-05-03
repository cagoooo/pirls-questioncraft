"use client";

// B.18: SW + version.json 自動更新提示
// 兩個機制並聯：
//  1. 註冊 sw.js，監聽 'controllerchange' → 立刻 reload（背景偷偷換版）
//  2. 每 5 分鐘 fetch version.json 比對，發現新版彈 toast banner 讓使用者主動點

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Sparkles, X } from 'lucide-react';

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

export function VersionUpdateBanner() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // ---- 1. 註冊 Service Worker ----
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let ignored = false;

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
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
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

  if (!latestVersion || dismissed) return null;

  const handleUpdate = async () => {
    // 清掉所有 SW caches → reload（最徹底）
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {}
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      reg?.waiting?.postMessage('SKIP_WAITING');
    }
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[calc(100%-2rem)] bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-2xl rounded-xl p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">有新版本可用</p>
          <p className="text-xs text-white/80 mt-1">
            {latestVersion}（目前 {currentVersion}）
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleUpdate}
              className="bg-white text-blue-700 hover:bg-blue-50"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              立即更新
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
              className="text-white hover:bg-white/10"
            >
              稍後
            </Button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-white/10"
          aria-label="關閉"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
