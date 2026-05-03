// functions/src/turnstile.ts
// Cloudflare Turnstile token 驗證。
// 使用方式：前端拿 widget token → 放在 request body 的 turnstileToken 欄位 →
// Cloud Function 呼叫 Cloudflare siteverify API 驗證。
//
// 設計原則：
//  - TURNSTILE_SECRET 沒設時自動 skip（讓功能先上線、之後再加保護）
//  - 驗證失敗回 403，呼叫端看 message 即可顯示給使用者

import type { Request } from 'firebase-functions/v2/https';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  ok: boolean;
  /** 失敗時的人類可讀理由 */
  reason?: string;
}

/**
 * 驗證 request body 內的 turnstileToken。
 * @param req Cloud Functions HTTPS request
 * @param secret Turnstile secret key（從 Firebase Secret Manager 注入）；未設定時跳過驗證並回 ok:true
 * @param remoteIp 用戶端 IP，可選，幫 Turnstile 做行為分析
 */
export async function verifyTurnstile(
  req: Request,
  secret: string | undefined,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  // 未設定 / placeholder → 跳過（功能尚未啟用 Turnstile）
  if (!secret || secret === 'PLACEHOLDER_NOT_CONFIGURED') return { ok: true };

  const token = (req.body as any)?.turnstileToken;
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: '缺少人機驗證 token，請重新整理頁面再試。' };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (remoteIp) params.append('remoteip', remoteIp);

    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      return {
        ok: false,
        reason: `人機驗證失敗：${(data['error-codes'] ?? ['unknown']).join(', ')}`,
      };
    }
    return { ok: true };
  } catch (e: any) {
    console.error('Turnstile verify error:', e);
    // Fail-closed: 若 Cloudflare API 連不上就拒絕（避免被繞過）
    return { ok: false, reason: '人機驗證服務暫時無法存取，請稍後再試。' };
  }
}
