// src/lib/api.ts
// 前端統一打 Cloud Functions 的 fetch wrapper。
// 路線 B 後，原本 import 的 Server Action 都改用本檔的函式。

// 與 functions/src/flows/generate-from-images.ts 中的 OutputSchema 對齊
import { getIdTokenOrNull } from './firebase-client';
export interface PirlsQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  /** 答案依據：只給老師看（老師畫面、教師講義），學生端與匯出檔都不放；舊題組沒有這欄 */
  answerEvidence?: string;
  pirlsLevel:
    | 'locate & retrieve'
    | 'make straightforward inferences'
    | 'interpret & integrate'
    | 'evaluate & critique';
}

export interface GeneratePirlsQuestionsOutput {
  title: string;
  articleContent: string;
  questions: PirlsQuestion[];
}

// Cloud Functions URL base，由 .env.local（local dev）/ GitHub Actions 注入
// 格式：https://<region>-<project-id>.cloudfunctions.net
//   asia-east1 + pirls-questioncraft → https://asia-east1-pirls-questioncraft.cloudfunctions.net
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  'https://asia-east1-pirls-questioncraft.cloudfunctions.net';

interface ApiOk<T> {
  success: true;
  data?: T;
  quizId?: string;
  quizData?: any;
}
interface ApiErr {
  success: false;
  error: string;
  /** v0.4.0：額度用完時的代碼（quota/daily-limit、quota/pool-exhausted） */
  code?: string;
  extensionUrl?: string;
  reviewUrl?: string;
}

/** postJSON 丟出的錯誤：帶 HTTP 狀態碼與後端的錯誤代碼 */
export type ApiError = Error & { status?: number; code?: string; extensionUrl?: string; reviewUrl?: string };
type ApiRes<T> = ApiOk<T> | ApiErr;

async function postJSON<T>(endpoint: string, body: unknown, onJson?: (json: any) => void): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // AI 出題需要 Google 登入：已登入就帶上憑證（其他端點帶了也無妨）
  const idToken = await getIdTokenOrNull();
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json: ApiRes<T> = await res.json().catch(() => ({
    success: false,
    error: `伺服器回應非 JSON（${res.status}）`,
  })) as ApiRes<T>;
  if (!res.ok || !json.success) {
    const err = new Error('error' in json ? json.error : `HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    if (!json.success) {
      err.code = json.code;
      err.extensionUrl = json.extensionUrl;
      err.reviewUrl = json.reviewUrl;
    }
    throw err;
  }
  onJson?.(json);
  return (json.data ?? (json as any)) as T;
}

async function getJSON<T>(
  endpoint: string,
  params: Record<string, string>,
  headers?: Record<string, string>
): Promise<T> {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), headers ? { headers } : undefined);
  const json: ApiRes<T> = await res.json().catch(() => ({
    success: false,
    error: `伺服器回應非 JSON（${res.status}）`,
  })) as ApiRes<T>;
  if (!res.ok || !json.success) {
    throw new Error('error' in json ? json.error : `HTTP ${res.status}`);
  }
  return (json as any) as T;
}

export type GradeId = '1' | '2' | '3' | '4' | '5' | '6';

/** v0.4.4：題數（5 題快速版／8 題標準／10 題延伸） */
export type QuestionMode = '5-questions' | '8-questions' | '10-questions';

export interface GenerateFromImagesArgs {
  photoDataUris: string[];
  questionMode: QuestionMode;
  languageMode: 'zh-TW' | 'en';
  /** 依年級改寫：'1'～'6'；不傳就照原文出題 */
  grade?: GradeId;
  /** B.4: Cloudflare Turnstile token，由 <Turnstile> widget 產出 */
  turnstileToken?: string;
}

export interface GenerateFromTextArgs {
  text: string;
  questionMode: QuestionMode;
  languageMode: 'zh-TW' | 'en';
  /** 依年級改寫：'1'～'6'；不傳就照原文出題 */
  grade?: GradeId;
  /** B.4: Cloudflare Turnstile token */
  turnstileToken?: string;
}

export async function generatePirlsQuestions(
  args: GenerateFromImagesArgs,
  onQuota?: (q: DailyQuotaMeta) => void
): Promise<GeneratePirlsQuestionsOutput> {
  return postJSON<GeneratePirlsQuestionsOutput>('generateFromImages', args, (j) => pickQuota(j, onQuota));
}

export async function generatePirlsQuestionsFromText(
  args: GenerateFromTextArgs,
  onQuota?: (q: DailyQuotaMeta) => void
): Promise<GeneratePirlsQuestionsOutput> {
  return postJSON<GeneratePirlsQuestionsOutput>('generateFromText', args, (j) => pickQuota(j, onQuota));
}

// ---- v0.4.1：今天還剩幾次、擴充套件引導點擊 ----

export interface DailyQuotaMeta {
  dailyRemaining: number;
  dailyLimit: number;
}

function pickQuota(json: any, cb?: (q: DailyQuotaMeta) => void) {
  if (cb && typeof json?.dailyRemaining === 'number' && typeof json?.dailyLimit === 'number') {
    cb({ dailyRemaining: json.dailyRemaining, dailyLimit: json.dailyLimit });
  }
}

export interface MyQuota extends DailyQuotaMeta {
  /** 開發者本月共用額度池還有沒有 */
  poolAvailable: boolean;
}

/** 已登入老師查今天還剩幾次（不扣次數）；查不到回 null，不影響出題 */
export async function getMyQuota(): Promise<MyQuota | null> {
  const idToken = await getIdTokenOrNull();
  if (!idToken) return null;
  try {
    const res = await fetch(`${API_BASE}/getMyQuota`, { headers: { Authorization: `Bearer ${idToken}` } });
    const json = await res.json();
    if (!res.ok || !json.success) return null;
    return { dailyRemaining: json.dailyRemaining, dailyLimit: json.dailyLimit, poolAvailable: json.poolAvailable !== false };
  } catch {
    return null;
  }
}

export type GuideSource = 'daily' | 'pool' | 'last-one' | 'banner' | 'hero';
export type GuideTarget = 'store' | 'review' | 'install';

/** 記一次引導按鈕點擊（只記次數，不記是誰）；用 sendBeacon，頁面跳走也送得出去 */
export function trackGuideClick(source: GuideSource, target: GuideTarget): void {
  try {
    const url = `${API_BASE}/trackGuideClick`;
    const body = JSON.stringify({ source, target });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) return;
    void fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).catch(() => {});
  } catch {
    /* 計數失敗不影響老師 */
  }
}

export interface CreateSharedQuizArgs {
  questionsOutput: GeneratePirlsQuestionsOutput;
  imageFilesDataURIs?: string[];
  inputText?: string;
  /** 為了未來 turnstile 也可選 */
  turnstileToken?: string;
}

/** teacherKey：v0.3.0 老師專用金鑰，只有出題老師拿得到，用來開全班成績儀表板 */
export async function createSharedQuiz(args: CreateSharedQuizArgs): Promise<{ quizId: string; teacherKey?: string }> {
  const r = await postJSON<{ quizId: string; teacherKey?: string }>('createSharedQuiz', args);
  // postJSON 已經把外層拆掉，這裡 r 就是 { quizId, teacherKey }
  return r as any;
}

// ---- v0.3.0: 老師專用儀表板連結 ----
// 金鑰放在網址 # 後面（不會送到任何伺服器、也不會出現在存取紀錄），
// 並記在出題老師這台裝置的 localStorage，沒帶金鑰的網址在同一台電腦也能開。

const TEACHER_KEY_STORAGE_PREFIX = 'pirls-teacher-key:';

export function rememberTeacherKey(quizId: string, teacherKey: string): void {
  try {
    localStorage.setItem(TEACHER_KEY_STORAGE_PREFIX + quizId, teacherKey);
  } catch {
    /* 無痕模式或封鎖儲存時略過，仍可用完整連結 */
  }
}

export function recallTeacherKey(quizId: string): string | null {
  try {
    return localStorage.getItem(TEACHER_KEY_STORAGE_PREFIX + quizId);
  } catch {
    return null;
  }
}

export function buildDashboardUrl(origin: string, basePath: string, quizId: string, teacherKey: string): string {
  return `${origin}${basePath}/dashboard/?id=${encodeURIComponent(quizId)}#k=${encodeURIComponent(teacherKey)}`;
}

export function readTeacherKeyFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const k = params.get('k');
  return k && k.trim() ? k.trim() : null;
}

export interface SharedQuizData {
  questionsOutput: GeneratePirlsQuestionsOutput;
  imageFilesDataURIs: string[];
  inputText?: string;
  createdAt?: number | null;
}

export async function getSharedQuiz(quizId: string): Promise<SharedQuizData> {
  const r = await getJSON<{ quizData: SharedQuizData }>('getSharedQuiz', { quizId });
  return (r as any).quizData;
}

// ---- B.16: 學生作答儀表板 ----

export interface StudentAnswerSubmission {
  quizId: string;
  studentInfo: { class: string; seatNumber: string; name: string };
  answers: (number | null)[];
  correctCount: number;
  totalCount: number;
  pirlsLevelStats: Record<string, { correct: number; total: number }>;
  /** v0.3.9：學生端產生的交卷編號，重送時沿用，後端只存一筆 */
  clientSubmissionId?: string;
}

export async function submitQuizAnswer(args: StudentAnswerSubmission): Promise<{ submissionId: string }> {
  return postJSON<{ submissionId: string }>('submitQuizAnswer', args) as any;
}

export interface SubmissionRecord {
  id: string;
  studentInfo: { class: string; seatNumber: string; name: string };
  answers: (number | null)[];
  correctCount: number;
  totalCount: number;
  pirlsLevelStats: Record<string, { correct: number; total: number }>;
  submittedAt: number | null;
}

export interface DashboardData {
  quizTitle: string | null;
  questions: PirlsQuestion[];
  submissions: SubmissionRecord[];
}

export async function getSubmissions(quizId: string, teacherKey: string): Promise<DashboardData> {
  const r = await getJSON<DashboardData>('getSubmissions', { quizId }, { Authorization: `Bearer ${teacherKey}` });
  return r as any;
}

// ---- B.26: Admin dashboard ----

export interface AdminDailyStat {
  date: string;
  'generate-images'?: number;
  'generate-text'?: number;
  'generate-images-failed'?: number;
  'generate-text-failed'?: number;
  'share-quiz'?: number;
  'submit-quiz'?: number;
}

export interface AdminPirlsBreakdown {
  level: string;
  accuracy: number;
  total: number;
}

export interface AdminStats {
  dailyStats: AdminDailyStat[];
  totals: {
    imageGen: number;
    textGen: number;
    imageGenFailed: number;
    textGenFailed: number;
    shares: number;
    submits: number;
  };
  totalSubmissions: number;
  avgAccuracy: number | null;
  pirlsBreakdown: AdminPirlsBreakdown[];
  /** v0.4.0：本月開發者共用額度池（舊後端沒有這欄） */
  quotaPool?: { month: string; spentTwd: number; budgetTwd: number; calls: number; allowed: boolean; resetAt: number };
  /** v0.4.1：30 天內擴充套件引導點擊（guide-來源-按鈕 → 次數） */
  guideClicks?: Record<string, number>;
  generatedAt: number;
}

export async function getAdminStats(adminKey: string): Promise<AdminStats> {
  const res = await fetch(`${API_BASE}/getAdminStats`, {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json as AdminStats;
}
