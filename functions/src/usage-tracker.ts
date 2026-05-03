// functions/src/usage-tracker.ts
// 輕量計數器：每天一個 doc，用 FieldValue.increment 原子遞增。
// 7 天的資料 = 7 個 doc，週報 fetch 一次 query 解決，便宜又快。
//
// Schema: usageStats/{YYYY-MM-DD}
//   {
//     date: '2026-05-03',
//     'generate-images': 12,
//     'generate-images-failed': 1,
//     'generate-text': 8,
//     'generate-text-failed': 0,
//     'share-quiz': 5,
//     'submit-quiz': 23,
//     updatedAt: Timestamp,
//   }
//
// TTL 90 天自動清（透過 expiresAt 欄位）

import { getFirestore, FieldValue, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';

export type UsageEvent =
  | 'generate-images'
  | 'generate-images-failed'
  | 'generate-text'
  | 'generate-text-failed'
  | 'share-quiz'
  | 'submit-quiz';

const COLLECTION = 'usageStats';
const TTL_DAYS = 90;

/** 今天日期字串（Asia/Taipei，YYYY-MM-DD） */
function todayInTaipei(): string {
  // 取 Asia/Taipei 當前日期
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // en-CA → YYYY-MM-DD
}

/**
 * 遞增今天的指定計數器，best-effort 不擋呼叫端。
 */
export function trackUsage(event: UsageEvent): void {
  const db = getFirestore();
  const date = todayInTaipei();
  const ttlMs = Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000;

  // fire-and-forget，不要 await（不要拖慢 endpoint 回應）
  db.collection(COLLECTION).doc(date).set(
    {
      [event]: FieldValue.increment(1),
      date,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(ttlMs),
    },
    { merge: true }
  ).catch((e: any) => {
    console.warn('[trackUsage] failed:', e?.message);
  });
}

/** 撈過去 N 天的 usageStats（含今天） */
export async function getRecentUsage(days: number): Promise<Record<string, any>[]> {
  const db = getFirestore();
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dates.push(formatter.format(d));
  }
  const refs = dates.map((d) => db.collection(COLLECTION).doc(d));
  const snaps = await db.getAll(...refs);
  return snaps
    .map((s: DocumentSnapshot, i: number) => ({
      date: dates[i],
      ...(s.exists ? s.data() : {}),
    }))
    .reverse(); // 最舊在前
}
