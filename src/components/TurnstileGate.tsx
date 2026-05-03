"use client";

// B.4: Cloudflare Turnstile widget wrapper
// 設計：NEXT_PUBLIC_TURNSTILE_SITE_KEY 沒設或為空 → 靜默 render null + 透過 onToken 給空字串
//      （讓開發/未啟用 Turnstile 階段功能照常）
//      設好之後 → render 隱形 widget，使用者按按鈕時自動取 token

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useRef, useEffect } from 'react';

interface TurnstileGateProps {
  /** 拿到 token 後 callback。token 為空字串代表「Turnstile 未啟用」 */
  onToken: (token: string) => void;
  /** 強制重置 widget（例如錯誤後想重新驗證） */
  resetSignal?: number;
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function TurnstileGate({ onToken, resetSignal }: TurnstileGateProps) {
  const ref = useRef<TurnstileInstance | null>(null);

  useEffect(() => {
    if (!SITE_KEY) {
      // 未啟用 Turnstile → 立刻給空 token，後端會跳過驗證
      onToken('');
    }
  }, [onToken]);

  useEffect(() => {
    if (resetSignal !== undefined) {
      ref.current?.reset();
    }
  }, [resetSignal]);

  if (!SITE_KEY) return null;

  return (
    <div className="my-4 flex justify-center">
      <Turnstile
        ref={ref}
        siteKey={SITE_KEY}
        options={{ theme: 'light', size: 'flexible' }}
        onSuccess={onToken}
        onExpire={() => onToken('')}
        onError={() => onToken('')}
      />
    </div>
  );
}

/** 給其他元件直接用的 helper：當 Turnstile 未啟用時為 true */
export const TURNSTILE_DISABLED = !SITE_KEY;
