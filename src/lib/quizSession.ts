// 學生作答頁的兩個小工具：
// 1. 作答進度暫存：每答一題就存在這台裝置（localStorage），頁面不小心關掉、重新整理、
//    iPad 切 App 回來被重新載入，都可以接著作答。交卷或結束測驗就清掉。
// 2. 「正在作答」旗標：作答中不跳「有新版本可用」提示，免得學生按了「立即更新」從頭來過。

import type { StudentInfo } from '@/app/quiz/page';

export interface SavedQuizProgress {
  v: 1;
  studentInfo: StudentInfo;
  answers: (number | null)[];
  currentIndex: number;
  savedAt: number;
}

const PROGRESS_PREFIX = 'pirls_progress_';
/** 超過 12 小時的進度視為過期（隔天同一台平板給別班用，不要再問） */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

const isStr = (v: unknown): v is string => typeof v === 'string';

export function loadQuizProgress(quizId: string, questionCount: number): SavedQuizProgress | null {
  const key = PROGRESS_PREFIX + quizId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedQuizProgress;
    const ok =
      p && p.v === 1 &&
      p.studentInfo && isStr(p.studentInfo.class) && isStr(p.studentInfo.seatNumber) && isStr(p.studentInfo.name) &&
      Array.isArray(p.answers) && p.answers.length === questionCount &&
      p.answers.every(a => a === null || (Number.isInteger(a) && a >= 0 && a < 10)) &&
      p.answers.some(a => a !== null) &&
      Number.isInteger(p.currentIndex) && p.currentIndex >= 0 && p.currentIndex < questionCount &&
      typeof p.savedAt === 'number' && Date.now() - p.savedAt < MAX_AGE_MS;
    if (!ok) {
      localStorage.removeItem(key);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function saveQuizProgress(
  quizId: string,
  data: { studentInfo: StudentInfo; answers: (number | null)[]; currentIndex: number },
): void {
  try {
    const p: SavedQuizProgress = { v: 1, ...data, savedAt: Date.now() };
    localStorage.setItem(PROGRESS_PREFIX + quizId, JSON.stringify(p));
  } catch { /* localStorage 不可用（隱私模式）就不暫存 */ }
}

export function clearQuizProgress(quizId: string): void {
  try { localStorage.removeItem(PROGRESS_PREFIX + quizId); } catch { /* ignore */ }
}

// ---- 交卷編號（v0.3.9）----
// 同一份作答重送時沿用同一個編號，後端用它當文件 ID，就不會存成兩筆。
// 存在 localStorage：送到一半頁面被關掉，重開後再交卷也還是同一個編號。
const SUBMIT_ID_PREFIX = 'pirls_submit_id_';

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateSubmitId(quizId: string): string {
  try {
    const old = localStorage.getItem(SUBMIT_ID_PREFIX + quizId);
    if (old && /^[A-Za-z0-9_-]{12,64}$/.test(old)) return old;
    const id = randomId();
    localStorage.setItem(SUBMIT_ID_PREFIX + quizId, id);
    return id;
  } catch {
    return randomId();
  }
}

export function clearSubmitId(quizId: string): void {
  try { localStorage.removeItem(SUBMIT_ID_PREFIX + quizId); } catch { /* ignore */ }
}

// ---- 正在作答旗標 ----
const ANSWERING_EVENT = 'pirls-quiz-answering';
let answering = false;

export function setQuizAnswering(on: boolean): void {
  if (answering === on) return;
  answering = on;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ANSWERING_EVENT, { detail: on }));
  }
}

export function isQuizAnswering(): boolean {
  return answering;
}

export function onQuizAnsweringChange(cb: (on: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
  window.addEventListener(ANSWERING_EVENT, handler);
  return () => window.removeEventListener(ANSWERING_EVENT, handler);
}
