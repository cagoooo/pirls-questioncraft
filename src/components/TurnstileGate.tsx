"use client";

// B.4: Cloudflare Turnstile widget wrapper
// 改用 vanilla Cloudflare Turnstile API（不依賴 @marsidev/react-turnstile）
// 解決 React 19 + static export 下 widget 載入失敗的時序問題。
//
// 設計：
// - script 在 layout.tsx <Script strategy="beforeInteractive"> 預先載入
// - 本元件 useEffect 內 poll window.turnstile 直到可用後 render
// - resetSignal 變化時呼叫 turnstile.reset() 讓 token 重新驗證
// - SITE_KEY 沒設時回 null + 立刻回空字串 token（讓後端跳過驗證）

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: string | HTMLElement, opts: TurnstileRenderOpts) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface TurnstileRenderOpts {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

interface TurnstileGateProps {
  onToken: (token: string) => void;
  /** 強制重置 widget 拿新 token */
  resetSignal?: number;
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function TurnstileGate({ onToken, resetSignal }: TurnstileGateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // 把 onToken 存到 ref，讓 effect 不需要把它放進 deps（避免重複 render widget）
  const onTokenRef = useRef(onToken);
  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);

  // Mount widget once script + container ready
  useEffect(() => {
    if (!SITE_KEY) {
      onTokenRef.current('');
      return;
    }

    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const tryRender = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return false;
      if (widgetIdRef.current) return true; // already rendered
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme: 'light',
          size: 'flexible',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
        return true;
      } catch (e) {
        console.warn('[TurnstileGate] render failed:', e);
        return false;
      }
    };

    if (!tryRender()) {
      // script 還沒載完，每 100ms poll
      pollId = setInterval(() => {
        if (tryRender() && pollId) {
          clearInterval(pollId);
          pollId = null;
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, []);

  // Reset on signal
  useEffect(() => {
    if (resetSignal === undefined || resetSignal === 0) return;
    if (widgetIdRef.current && window.turnstile) {
      try { window.turnstile.reset(widgetIdRef.current); } catch {}
    }
  }, [resetSignal]);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className="my-4 flex justify-center" />;
}

/** 給其他元件直接用的 helper：當 Turnstile 未啟用時為 true */
export const TURNSTILE_DISABLED = !SITE_KEY;
