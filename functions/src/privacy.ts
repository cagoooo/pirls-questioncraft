// functions/src/privacy.ts
// v0.3.0 學生隱私防線（純函式，方便單元測試）：
//  1. 老師專用金鑰：建立分享時產生，只回給出題老師；Firestore 只存 SHA-256 雜湊。
//     全班成績（getSubmissions）必須帶正確金鑰，學生把 /quiz/ 改成 /dashboard/ 也讀不到。
//  2. 交卷通知只帶測驗代號、班級、座號與統計，不帶學生姓名。

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** 產生不可猜的老師專用金鑰（192 bits，base64url） */
export function generateTeacherKey(): string {
  return randomBytes(24).toString('base64url');
}

export function hashTeacherKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** 從 Authorization: Bearer xxx 取出老師金鑰（不收網址參數，避免金鑰進存取紀錄） */
export function extractTeacherKey(authorizationHeader: unknown): string | null {
  if (typeof authorizationHeader !== 'string') return null;
  if (!authorizationHeader.startsWith('Bearer ')) return null;
  const key = authorizationHeader.slice(7).trim();
  return key.length > 0 ? key : null;
}

/**
 * 比對老師金鑰。storedHashes = 測驗本體與各筆作答上存的雜湊（測驗本體 60 分鐘後會被清掉，
 * 作答紀錄保留 7 天，所以兩邊都存）。沒有任何雜湊（安全更新前建立的舊測驗）一律拒絕。
 */
export function isTeacherKeyValid(
  storedHashes: Array<string | null | undefined>,
  providedKey: string | null
): boolean {
  if (!providedKey) return false;
  const hashes = storedHashes.filter((h): h is string => typeof h === 'string' && h.length === 64);
  if (hashes.length === 0) return false;
  const provided = Buffer.from(hashTeacherKey(providedKey), 'hex');
  return hashes.every((h) => {
    const stored = Buffer.from(h, 'hex');
    return stored.length === provided.length && timingSafeEqual(stored, provided);
  });
}

/** 從測驗文件移除不該回給學生端的欄位 */
export function stripTeacherSecrets<T extends Record<string, unknown>>(data: T): Omit<T, 'teacherKeyHash'> {
  const { teacherKeyHash: _hidden, ...rest } = data;
  return rest;
}

export interface SubmissionNotifyInput {
  quizId: string;
  quizTitle: string;
  studentInfo: { class?: unknown; seatNumber?: unknown; name?: unknown } | null | undefined;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  studentWeakest?: { label: string; accuracy: number } | null;
  classAvgAccuracy: number;
  totalSubs: number;
  classWeakest?: { label: string; accuracy: number } | null;
}

export interface NotifyField {
  icon: string;
  label: string;
  value: string;
}

function safeText(v: unknown, maxLen: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLen) || '—';
}

/** 交卷通知欄位：只有測驗代號、班級、座號與統計，刻意不讀學生姓名欄位 */
export function buildSubmissionNotifyFields(input: SubmissionNotifyInput): NotifyField[] {
  const cls = safeText(input.studentInfo?.class, 20);
  const seat = safeText(input.studentInfo?.seatNumber, 10);
  return [
    { icon: '📝', label: '測驗', value: input.quizTitle },
    { icon: '🆔', label: '測驗代號', value: input.quizId },
    { icon: '🏫', label: '班級座號', value: `${cls} ${seat}號` },
    { icon: '✅', label: '答對', value: `${input.correctCount} / ${input.totalCount}（${input.accuracy}%）` },
    ...(input.studentWeakest
      ? [{ icon: '⚠️', label: '個人弱項', value: `${input.studentWeakest.label}（${Math.round(input.studentWeakest.accuracy)}%）` }]
      : []),
    { icon: '📈', label: '班級平均', value: `${input.classAvgAccuracy.toFixed(1)}%（${input.totalSubs} 人）` },
    ...(input.classWeakest
      ? [{ icon: '🎯', label: '班級弱項', value: `${input.classWeakest.label}（${Math.round(input.classWeakest.accuracy)}%）` }]
      : []),
  ];
}
