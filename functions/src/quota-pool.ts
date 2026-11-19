// functions/src/quota-pool.ts
// v0.4.0：開發者每月共用額度池。
//
// 阿凱老師每個月提供固定金額（預設 NT$50）給大家共用 AI 出題。
// 每次 AI 呼叫結束，依 Gemini 回傳的實際 token 數換算成台幣，累加到本月的帳上；
// 累計達上限後，AI 出題改回「共用額度已用完」並引導老師改用 Chrome 擴充套件
// （用自己的免費 Gemini 金鑰繼續出題），每月 1 日（台北時間）自動重新開放。
//
// 想調整金額不用重新部署：在 Firestore 建 appConfig/quotaPool，欄位 budgetTwd（數字）。
//
// Schema: quotaPool/{YYYY-MM}
//   { spentTwd, calls, inputTokens, outputTokens, notified80, notified100, month }

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/** 預設每月共用金額（台幣） */
export const DEFAULT_BUDGET_TWD = 50;

/**
 * Gemini 2.5 Flash 付費方案標準價格（美元／每百萬 token）。
 * 2026-11-19 查 Google AI Studio 價格頁：輸入（文字／圖片）$0.30、輸出（含思考 token）$2.50。
 * 換模型時要一起改。
 */
export const PRICE_USD_PER_M = { input: 0.3, output: 2.5 };

/** 美元換台幣的估算匯率（保守取整數；只用來估算，不是實際帳單） */
export const USD_TO_TWD = 32;

/** 給前端的引導連結 */
export const EXTENSION_STORE_URL = 'https://chromewebstore.google.com/detail/cfbehdinangicblpbnockoofeccmoidp';
export const EXTENSION_REVIEW_URL = `${EXTENSION_STORE_URL}/reviews`;

export const POOL_EXHAUSTED_CODE = 'quota/pool-exhausted';
export const POOL_EXHAUSTED_MESSAGE =
  '開發者提供的本月共用額度池已經用完了。請改用我們開發的 Chrome 擴充套件「PIRLS 閱讀題組小幫手」，' +
  '用你自己的免費 Gemini 金鑰繼續出題；用得順手的話，也請到商店給我們五星好評 ⭐⭐⭐⭐⭐，讓更多老師知道這個工具！' +
  '共用額度會在下個月 1 日（台北時間）重新開放。';

/** 今天的次數用完時：一樣引導改用擴充套件（讓老師早點習慣到擴充套件出題） */
export const DAILY_LIMIT_CODE = 'quota/daily-limit';
export function dailyLimitMessage(limit: number): string {
  return `你今天的 ${limit} 次共用出題已經用完了，明天（台北時間午夜後）會再給你 ${limit} 次。` +
    '想現在繼續出題，可以改用我們開發的 Chrome 擴充套件「PIRLS 閱讀題組小幫手」，用你自己的免費 Gemini 金鑰，次數不受限制；' +
    '用得順手的話，也請到商店給我們五星好評 ⭐⭐⭐⭐⭐，讓更多老師知道這個工具！';
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  thoughtsTokens?: number;
}

/** 一次 AI 呼叫的估算花費（台幣）。思考 token 照輸出價計算。 */
export function estimateCostTwd(u: TokenUsage): number {
  const input = Math.max(0, Number(u.inputTokens) || 0);
  const output = Math.max(0, Number(u.outputTokens) || 0) + Math.max(0, Number(u.thoughtsTokens) || 0);
  const usd = (input * PRICE_USD_PER_M.input + output * PRICE_USD_PER_M.output) / 1_000_000;
  return usd * USD_TO_TWD;
}

/** 台北時間的月份（YYYY-MM），每月 1 日午夜換月 */
export function taipeiMonth(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit',
  }).format(new Date(now)).slice(0, 7);
}

/** 下個月 1 日台北午夜的 epoch ms */
export function nextTaipeiMonthStart(now = Date.now()): number {
  const [y, m] = taipeiMonth(now).split('-').map(Number);
  // 台北 = UTC+8：下個月 1 日 00:00 台北 = 前一天 16:00 UTC
  return Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - 8 * 60 * 60 * 1000;
}

/** 這次累加讓花費跨過了哪個通知門檻（80% 或 100%），沒跨過回 null */
export function crossedThreshold(before: number, after: number, budget: number): 80 | 100 | null {
  if (budget <= 0) return null;
  if (before < budget && after >= budget) return 100;
  if (before < budget * 0.8 && after >= budget * 0.8) return 80;
  return null;
}

const COLLECTION = 'quotaPool';

let budgetCache: { value: number; at: number } | null = null;

/** 本月共用金額：appConfig/quotaPool.budgetTwd，讀不到就用預設值；快取 60 秒 */
export async function getBudgetTwd(): Promise<number> {
  if (budgetCache && Date.now() - budgetCache.at < 60_000) return budgetCache.value;
  let value = DEFAULT_BUDGET_TWD;
  try {
    const snap = await getFirestore().collection('appConfig').doc('quotaPool').get();
    const v = Number((snap.data() as any)?.budgetTwd);
    if (Number.isFinite(v) && v >= 0) value = v;
  } catch (e) {
    console.error('quota pool budget read failed, use default:', e);
  }
  budgetCache = { value, at: Date.now() };
  return value;
}

export interface PoolStatus {
  month: string;
  spentTwd: number;
  budgetTwd: number;
  calls: number;
  allowed: boolean;
  resetAt: number;
}

/** 查本月額度池狀態；讀取失敗時放行（fail-open），不讓老師因為統計壞掉而不能用 */
export async function getPoolStatus(): Promise<PoolStatus> {
  const month = taipeiMonth();
  const resetAt = nextTaipeiMonthStart();
  const budgetTwd = await getBudgetTwd();
  try {
    const snap = await getFirestore().collection(COLLECTION).doc(month).get();
    const d = (snap.data() as any) || {};
    const spentTwd = Number(d.spentTwd) || 0;
    return { month, spentTwd, budgetTwd, calls: Number(d.calls) || 0, allowed: spentTwd < budgetTwd, resetAt };
  } catch (e) {
    console.error('quota pool read failed, fail-open:', e);
    return { month, spentTwd: 0, budgetTwd, calls: 0, allowed: true, resetAt };
  }
}

/**
 * 把這次 AI 呼叫的用量記到本月帳上。
 * 回傳累加前後的金額，讓呼叫端決定要不要發 80%／100% 通知（每個門檻每月只通知一次）。
 */
export async function recordPoolUsage(
  usages: TokenUsage[]
): Promise<{ before: number; after: number; budgetTwd: number; notify: 80 | 100 | null; month: string } | null> {
  if (usages.length === 0) return null;
  const cost = usages.reduce((s, u) => s + estimateCostTwd(u), 0);
  const inputTokens = usages.reduce((s, u) => s + (Number(u.inputTokens) || 0), 0);
  const outputTokens = usages.reduce((s, u) => s + (Number(u.outputTokens) || 0) + (Number(u.thoughtsTokens) || 0), 0);
  const month = taipeiMonth();
  const budgetTwd = await getBudgetTwd();
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(month);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = (snap.data() as any) || {};
      const before = Number(d.spentTwd) || 0;
      const after = before + cost;
      let notify = crossedThreshold(before, after, budgetTwd);
      if (notify === 100 && d.notified100) notify = null;
      if (notify === 80 && d.notified80) notify = null;
      tx.set(
        ref,
        {
          month,
          spentTwd: after,
          calls: FieldValue.increment(1),
          inputTokens: FieldValue.increment(inputTokens),
          outputTokens: FieldValue.increment(outputTokens),
          updatedAt: FieldValue.serverTimestamp(),
          ...(notify === 100 ? { notified100: true, notified80: true } : {}),
          ...(notify === 80 ? { notified80: true } : {}),
        },
        { merge: true }
      );
      return { before, after, budgetTwd, notify, month };
    });
  } catch (e) {
    console.error('quota pool record failed:', e);
    return null;
  }
}
