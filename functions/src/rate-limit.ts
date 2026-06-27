// functions/src/rate-limit.ts
// 用 Firestore counter 做 IP 固定時間窗限流。
// 兩個關鍵設計：
//  1. 寫入用 transaction + serverTimestamp，避免並發 race
//  2. 計數欄存到 rateLimits/{ip}_{bucket}，doc TTL 自動清，不留垃圾
//  3. 失敗時 fail-open（限流系統壞了寧可放行，不要擋住正常使用者）

import { getFirestore, Timestamp, type Transaction } from 'firebase-admin/firestore';

const COLLECTION = 'rateLimits';
const TTL_MINUTES = 5;
const ONE_MINUTE_MS = 60_000;

export interface RateLimitOptions {
  /** 每分鐘最多幾次。預設 10 */
  perMinute?: number;
  /** 指定時間窗內最多幾次。若設定，優先於 perMinute */
  limit?: number;
  /** 時間窗長度（毫秒）。若設定 limit，預設仍為 1 分鐘 */
  windowMs?: number;
  /** 過期 TTL，分鐘數，避免 doc 累積。預設 5 分鐘 */
  ttlMinutes?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  reason?: string;
}

/**
 * 檢查並遞增 IP 計數。
 * 回傳 { allowed: false } 時調用方應回 HTTP 429。
 */
export async function checkRateLimit(
  ip: string,
  opts: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const windowMs = opts.windowMs ?? ONE_MINUTE_MS;
  const limit = opts.limit ?? opts.perMinute ?? 10;
  const ttlMinutes = opts.ttlMinutes ?? Math.max(TTL_MINUTES, Math.ceil(windowMs / ONE_MINUTE_MS) + 1);

  // 用固定時間窗當 bucket key（同一時間窗內的請求共用 counter）
  const bucket = Math.floor(Date.now() / windowMs);
  const docId = `${sanitizeIp(ip)}_${windowMs}_${bucket}`;
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(docId);

  try {
    const result = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      const current = (snap.exists && (snap.data() as any)?.count) || 0;

      if (current >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: (bucket + 1) * windowMs,
          reason: `Rate limit exceeded: ${limit} requests/${windowMs}ms`,
        };
      }

      const expiresAt = Timestamp.fromMillis(Date.now() + ttlMinutes * 60_000);
      tx.set(
        ref,
        { count: current + 1, expiresAt, ip: ip.slice(0, 64), bucket, windowMs },
        { merge: true }
      );

      return {
        allowed: true,
        remaining: limit - current - 1,
        resetAt: (bucket + 1) * windowMs,
      };
    });
    return result;
  } catch (e) {
    // Fail-open: 限流系統壞掉寧可放行
    console.error('rate-limit check failed, fail-open:', e);
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  }
}

function sanitizeIp(ip: string): string {
  // Firestore doc id 不能含 /，且不可超過 1500 bytes
  return ip.replace(/[^\w.:-]/g, '_').slice(0, 64);
}

/** 從 Express request 抽出真正 client IP（Cloud Functions 有多層 proxy） */
export function getClientIp(req: { headers: any; ip?: string }): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}
