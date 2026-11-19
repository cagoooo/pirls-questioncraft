// functions/src/submission.ts
// v0.3.9 學生交卷的兩個小規則（純函式，方便單元測試）：
//  1. 限流改用「網路位址＋測驗代號」計算：全校平板共用同一個對外網路位址，
//     原本「每個位址每分鐘 5 次」會讓同一分鐘交卷的第 6 位學生被擋下。
//  2. 學生端自帶一個交卷編號，網路不穩重送時同一份作答只會存一筆。

/** 同一個網路位址、同一份測驗，每分鐘最多收幾份交卷（一班 30 人同一分鐘交完也夠） */
export const SUBMIT_PER_MINUTE = 60;

export function submitRateKey(ip: string, quizId: unknown): string {
  const q = typeof quizId === 'string' ? quizId.replace(/[^\w-]/g, '').slice(0, 32) : '';
  return `${ip}|submit|${q || 'none'}`;
}

/** 學生端產生的交卷編號：只收英數、底線、連字號，12～64 字 */
export function isValidClientSubmissionId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{12,64}$/.test(v);
}
