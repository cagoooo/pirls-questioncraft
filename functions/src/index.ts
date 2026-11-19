// functions/src/index.ts
// 4 個 HTTPS Cloud Functions endpoint：
//  - generateFromImages   POST  圖片陣列 → 題組（要 Turnstile + 限流）
//  - generateFromText     POST  純文字 → 題組（要 Turnstile + 限流）
//  - createSharedQuiz     POST  存共享測驗到 Firestore（要限流，不需 Turnstile）
//  - getSharedQuiz        GET   依 quizId 取共享測驗（不限流，學生端純讀）
// 全部成功/失敗都會 LINE 推卡片給管理員（B.14）。

import { onRequest, type Request } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import corsLib from 'cors';
import type { Response } from 'express';

import { runGenerateFromImages } from './flows/generate-from-images';
import { runGenerateFromText } from './flows/generate-from-text';
import { runRewriteForGrade, isGradeId, gradeInfo } from './flows/rewrite-for-grade';
import { checkRateLimit, checkDailyUserLimit, getClientIp } from './rate-limit';
import { verifyTurnstile } from './turnstile';
import { notifyAdminCard } from './notify-line';
import { trackUsage, getRecentUsage } from './usage-tracker';
import { getAuth } from 'firebase-admin/auth';
import { runWeeklyDigest } from './weekly-digest';
import { isValidClientSubmissionId, submitRateKey, SUBMIT_PER_MINUTE } from './submission';
import {
  buildMilestoneNotifyFields,
  buildSubmissionNotifyFields,
  extractTeacherKey,
  generateTeacherKey,
  hashTeacherKey,
  isTeacherKeyValid,
  stripTeacherSecrets,
  submissionNotifyKind,
  SUBMISSION_NOTIFY_EVERY,
} from './privacy';

initializeApp();
const db = getFirestore();

const cors = corsLib({ origin: true });

setGlobalOptions({
  region: 'asia-east1',
  maxInstances: 10,
  memory: '1GiB',
  timeoutSeconds: 120,
});

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
// B.4: Cloudflare Turnstile secret。未設定時自動跳過驗證（功能尚未啟用 Turnstile）。
const TURNSTILE_SECRET = defineSecret('TURNSTILE_SECRET');
// B.14: LINE Bot 共用 Channel 的 Token + 管理員 userId（PIRLS_ 前綴與其他專案隔離）
const PIRLS_LINE_CHANNEL_ACCESS_TOKEN = defineSecret('PIRLS_LINE_CHANNEL_ACCESS_TOKEN');
const PIRLS_LINE_ADMIN_USER_ID = defineSecret('PIRLS_LINE_ADMIN_USER_ID');
const GOOGLE_CHAT_WEBHOOK_URL = defineSecret('GOOGLE_CHAT_WEBHOOK_URL');
// B.26: Admin dashboard 授權用 key（Bearer token 比對）
const PIRLS_ADMIN_KEY = defineSecret('PIRLS_ADMIN_KEY');

const APP_NAME = 'PIRLS閱讀理解生成站 PRO';
const SITE_BASE_URL = 'https://cagoooo.github.io/pirls-questioncraft';
const COLLECTION = 'sharedQuizzes';
const QUIZ_EXPIRY_MS = 60 * 60 * 1000;
const MAX_PAYLOAD_BYTES = 900 * 1024;
const ONE_HOUR_MS = 60 * 60 * 1000;

const PIRLS_LEVEL_LABEL: Record<string, string> = {
  'locate & retrieve': '訊息提取',
  'make straightforward inferences': '直接推論',
  'interpret & integrate': '詮釋整合',
  'evaluate & critique': '評估批判',
};

/** 統計題目分布成「訊息2 直接2 詮釋2 評估2」格式 */
function summarizePirlsDistribution(questions: Array<{ pirlsLevel: string }>): string {
  const counts: Record<string, number> = {};
  questions.forEach((q) => {
    counts[q.pirlsLevel] = (counts[q.pirlsLevel] ?? 0) + 1;
  });
  return Object.entries(PIRLS_LEVEL_LABEL)
    .map(([key, label]) => `${label}${counts[key] ?? 0}`)
    .join('・');
}

/** 取文字摘要（前 N 字 + 省略號） */
function summarizeText(text: string, maxLen = 80): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '...' : cleaned;
}

// Firestore 單筆文件上限 1 MiB，預留空間給題目與欄位名稱
const PREVIEW_IMAGE_BUDGET_BYTES = 700 * 1024;

/** 建立管理員預覽用 quiz；圖片太大就改存文章文字。失敗只記 log，不影響出題結果。 */
async function savePreviewQuiz(
  questionsOutput: { articleContent?: string },
  photoDataUris: string[],
  inputText: string
): Promise<string | null> {
  const imagesBytes = photoDataUris.reduce((sum, d) => sum + d.length, 0);
  const keepImages = imagesBytes <= PREVIEW_IMAGE_BUDGET_BYTES;
  const quizId = generateUniqueId();
  try {
    await db.collection(COLLECTION).doc(quizId).set({
      questionsOutput,
      imageFilesDataURIs: keepImages ? photoDataUris : [],
      inputText: keepImages ? inputText : (questionsOutput.articleContent ?? ''),
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + QUIZ_EXPIRY_MS),
    });
    return quizId;
  } catch (e) {
    console.error('savePreviewQuiz failed:', e);
    return null;
  }
}

function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 12) + Date.now().toString(36).substring(4);
}

function withCors(handler: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response) =>
    new Promise<void>((resolve) => {
      cors(req, res, async () => {
        try {
          await handler(req, res);
        } catch (e: any) {
          console.error('Function error:', e);
          if (!res.headersSent) {
            res.status(500).json({ success: false, error: e?.message ?? 'Internal error' });
          }
        }
        resolve();
      });
    });
}

/** 已登入的 Google 使用者（AI 出題端點會掛在 req.pirlsUser） */
type PirlsUser = { uid: string; name: string; email: string };
const LOGIN_REQUIRED_MESSAGE = '請先用 Google 帳號登入才能出題';

/** 驗證 Authorization: Bearer <Firebase ID Token>；沒帶、無效或非 Google 登入回 null */
async function verifyGoogleUser(req: Request): Promise<{ user: PirlsUser | null; reason: string }> {
  const m = (req.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return { user: null, reason: '未帶登入憑證' };
  try {
    const d = await getAuth().verifyIdToken(m[1]);
    if (d.firebase?.sign_in_provider !== 'google.com') return { user: null, reason: '不是 Google 登入' };
    return {
      user: { uid: d.uid, name: String(d.name || d.email || d.uid), email: String(d.email || '') },
      reason: '',
    };
  } catch {
    return { user: null, reason: '登入憑證無效或過期' };
  }
}

// 未登入被擋的通知：同一 IP 每 5 分鐘最多 1 則，避免被狂打時洗版
const blockedNotifyAt = new Map<string, number>();
function notifyLoginBlocked(ip: string, endpoint: string, reason: string): void {
  const now = Date.now();
  if (now - (blockedNotifyAt.get(ip) ?? 0) < 5 * 60_000) return;
  blockedNotifyAt.set(ip, now);
  if (blockedNotifyAt.size > 500) blockedNotifyAt.clear();
  notifyAdminCard({
    status: 'warning',
    title: '未登入的出題請求被擋下',
    appName: APP_NAME,
    fields: [
      { icon: '🚪', label: '端點', value: endpoint },
      { icon: '📌', label: '原因', value: reason },
      { icon: '🌍', label: '來源', value: ip },
    ],
    footerNote: '已在呼叫 Gemini 前擋下（同一來源 5 分鐘內只通知一次）',
  });
}

/** 加速率限制 + Turnstile 驗證的中介層，包在 AI 出題類 endpoint 上 */
function withProtection(
  handler: (req: Request, res: Response) => Promise<void> | void,
  opts: {
    perMinute?: number;
    limit?: number;
    windowMs?: number;
    windowLabel?: string;
    needTurnstile?: boolean;
    /** 必須 Google 登入（2026-11-15 起 AI 出題需要） */
    requireGoogleLogin?: boolean;
    /** 每位登入使用者每天最多幾次（台北午夜重置）；設定後取代 IP 限流 */
    dailyUserLimit?: number;
    endpointName?: string;
    /** 限流計數用的鍵（預設是網路位址） */
    rateKey?: (req: Request, ip: string) => string;
    /** 被限流時給使用者看的訊息 */
    rateLimitMessage?: (limit: number, windowLabel: string) => string;
  } = {}
) {
  const {
    perMinute,
    limit = perMinute ?? 5,
    windowMs = 60_000,
    windowLabel = windowMs === ONE_HOUR_MS ? '小時' : '分鐘',
    needTurnstile = true,
    requireGoogleLogin = false,
    dailyUserLimit,
    endpointName = 'AI 出題',
    rateKey,
    rateLimitMessage,
  } = opts;
  return withCors(async (req, res) => {
    const ip = getClientIp(req);

    // 1) Google 登入
    let user: PirlsUser | null = null;
    if (requireGoogleLogin) {
      const verified = await verifyGoogleUser(req);
      if (!verified.user) {
        notifyLoginBlocked(ip, endpointName, verified.reason);
        res.status(401).json({ success: false, error: LOGIN_REQUIRED_MESSAGE, code: 'auth/google-login-required' });
        return;
      }
      user = verified.user;
      (req as any).pirlsUser = user;
    } else {
      const rateLimit = await checkRateLimit(rateKey ? rateKey(req, ip) : ip, { limit, windowMs });
      if (!rateLimit.allowed) {
        res.status(429).json({
          success: false,
          error: rateLimitMessage ? rateLimitMessage(limit, windowLabel) : `為了保護共用的 Gemini API 額度，題組生成目前限制每個使用者每${windowLabel}最多 ${limit} 次。請稍候再試，並把生成次數留給實際備課或教學使用。`,
          resetAt: rateLimit.resetAt,
        });
        return;
      }
    }

    // 2) Turnstile 人機驗證（保留）
    if (needTurnstile) {
      const verify = await verifyTurnstile(req, process.env.TURNSTILE_SECRET, ip);
      if (!verify.ok) {
        res.status(403).json({ success: false, error: verify.reason });
        return;
      }
    }

    // 3) 每位登入使用者每天的次數（通過人機驗證才計次）
    if (user && dailyUserLimit) {
      const daily = await checkDailyUserLimit(user.uid, dailyUserLimit);
      if (!daily.allowed) {
        res.status(429).json({
          success: false,
          error: `為了保護共用的 Gemini API 額度，每位老師每天最多可生成 ${dailyUserLimit} 次，明天（台北時間午夜後）就能再使用。`,
          resetAt: daily.resetAt,
        });
        return;
      }
      (req as any).pirlsRemaining = daily.remaining;
    }

    await handler(req, res);
  });
}

/** 通知卡上的使用者欄位 */
function userField(req: Request) {
  const u = (req as any).pirlsUser as PirlsUser | undefined;
  const remaining = (req as any).pirlsRemaining as number | undefined;
  return [
    { icon: '👤', label: '使用者', value: u ? `${u.name}${u.email ? `（${u.email}）` : ''}` : '未登入' },
    ...(typeof remaining === 'number' ? [{ icon: '🔢', label: '今日剩餘', value: `${remaining} 次` }] : []),
  ];
}

/** 取要監看的 secrets（給 onRequest 的 secrets 陣列用） */
const NOTIFY_SECRETS = [
  PIRLS_LINE_CHANNEL_ACCESS_TOKEN,
  PIRLS_LINE_ADMIN_USER_ID,
  GOOGLE_CHAT_WEBHOOK_URL
];

// ---- AI flows ----

export const generateFromImages = onRequest(
  // 依年級改寫要連續呼叫兩次 AI（改寫＋出題），放寬到 240 秒
  { secrets: [GEMINI_API_KEY, TURNSTILE_SECRET, ...NOTIFY_SECRETS], timeoutSeconds: 240 },
  withProtection(
    async (req, res) => {
      const t0 = Date.now();
      const ip = getClientIp(req);
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Use POST' });
        return;
      }
      const { photoDataUris, questionMode, languageMode } = req.body ?? {};
      const grade = isGradeId(req.body?.grade) ? req.body.grade : undefined;
      if (!Array.isArray(photoDataUris) || photoDataUris.length === 0) {
        res.status(400).json({ success: false, error: 'photoDataUris 不可為空。' });
        return;
      }
      try {
        // 選了年級：先依年級改寫圖片中的文章，再依同一個年級出題
        const result = grade
          ? await runGenerateFromText({
              text: (await runRewriteForGrade({ photoDataUris, grade })).articleContent,
              questionMode,
              languageMode,
              grade,
            })
          : await runGenerateFromImages({ photoDataUris, questionMode, languageMode });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        trackUsage('generate-images');
        // 估圖片總大小（base64 ≈ 4/3 原始 bytes）
        const estKB = Math.round(photoDataUris.reduce((sum, d) => sum + d.length, 0) * 0.75 / 1024);

        const quizId = grade
          ? await savePreviewQuiz(result, [], result.articleContent)
          : await savePreviewQuiz(result, photoDataUris, '圖片出題');
        const previewUrl = quizId ? `${SITE_BASE_URL}/quiz/?id=${quizId}` : null;

        notifyAdminCard({
          status: 'success',
          title: '有人剛完成圖片出題',
          appName: APP_NAME,
          fields: [
            ...userField(req),
            { icon: '📷', label: '圖片', value: `${photoDataUris.length} 張（${estKB} KB）` },
            { icon: '📝', label: '標題', value: result.title },
            { icon: '📏', label: '文章', value: `${result.articleContent.length} 字` },
            { icon: '🎒', label: '年級', value: grade ? `改寫成${gradeInfo(grade).gradeLabel}` : '原文' },
            { icon: '🎯', label: '題數', value: questionMode === '10-questions' ? '10 題' : '8 題' },
            { icon: '⚖️', label: 'PIRLS', value: summarizePirlsDistribution(result.questions) },
            { icon: '🌐', label: '語言', value: languageMode === 'en' ? 'English' : '繁體中文' },
            { icon: '🌍', label: '來源', value: ip },
            { icon: '⏱️', label: '耗時', value: `${elapsed}s` },
          ],
          body: `📖 文章摘要\n${summarizeText(result.articleContent, 100)}`,
          actions: previewUrl
            ? [{ label: '🔍 預覽出題結果', uri: previewUrl, style: 'primary' }]
            : undefined,
        });
        res.json({ success: true, data: result });
      } catch (e: any) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        trackUsage('generate-images-failed');
        notifyAdminCard({
          status: 'failed',
          title: '圖片出題失敗',
          appName: APP_NAME,
          fields: [
            ...userField(req),
            { icon: '📷', label: '圖片', value: `${photoDataUris.length} 張` },
            { icon: '🌍', label: '來源', value: ip },
            { icon: '💬', label: '錯誤', value: (e?.message ?? String(e)).slice(0, 250) },
          ],
          footerNote: `⏱️ ${elapsed}s`,
        });
        throw e;
      }
    },
    { requireGoogleLogin: true, dailyUserLimit: 3, endpointName: '圖片出題' }
  )
);

export const generateFromText = onRequest(
  { secrets: [GEMINI_API_KEY, TURNSTILE_SECRET, ...NOTIFY_SECRETS], timeoutSeconds: 240 },
  withProtection(
    async (req, res) => {
      const t0 = Date.now();
      const ip = getClientIp(req);
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Use POST' });
        return;
      }
      const { text, questionMode, languageMode } = req.body ?? {};
      const grade = isGradeId(req.body?.grade) ? req.body.grade : undefined;
      if (typeof text !== 'string' || text.trim().length === 0) {
        res.status(400).json({ success: false, error: 'text 不可為空。' });
        return;
      }
      try {
        const article = grade ? (await runRewriteForGrade({ text, grade })).articleContent : text;
        const result = await runGenerateFromText({ text: article, questionMode, languageMode, grade });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        trackUsage('generate-text');

        const quizId = await savePreviewQuiz(result, [], article);
        const previewUrl = quizId ? `${SITE_BASE_URL}/quiz/?id=${quizId}` : null;

        notifyAdminCard({
          status: 'success',
          title: '有人剛完成文字出題',
          appName: APP_NAME,
          fields: [
            ...userField(req),
            { icon: '📝', label: '標題', value: result.title },
            { icon: '📏', label: '字數', value: grade ? `${text.length} → ${article.length}` : `${text.length}` },
            { icon: '🎒', label: '年級', value: grade ? `改寫成${gradeInfo(grade).gradeLabel}` : '原文' },
            { icon: '🎯', label: '題數', value: questionMode === '10-questions' ? '10 題' : '8 題' },
            { icon: '⚖️', label: 'PIRLS', value: summarizePirlsDistribution(result.questions) },
            { icon: '🌐', label: '語言', value: languageMode === 'en' ? 'English' : '繁體中文' },
            { icon: '🌍', label: '來源', value: ip },
            { icon: '⏱️', label: '耗時', value: `${elapsed}s` },
          ],
          body: `📖 文章摘要\n${summarizeText(text, 100)}`,
          actions: previewUrl
            ? [{ label: '🔍 預覽出題結果', uri: previewUrl, style: 'primary' }]
            : undefined,
        });
        res.json({ success: true, data: result });
      } catch (e: any) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        trackUsage('generate-text-failed');
        notifyAdminCard({
          status: 'failed',
          title: '文字出題失敗',
          appName: APP_NAME,
          fields: [
            ...userField(req),
            { icon: '📏', label: '字數', value: `${text.length}` },
            { icon: '🌍', label: '來源', value: ip },
            { icon: '💬', label: '錯誤', value: (e?.message ?? String(e)).slice(0, 250) },
          ],
          footerNote: `⏱️ ${elapsed}s`,
        });
        throw e;
      }
    },
    { requireGoogleLogin: true, dailyUserLimit: 3, endpointName: '文字出題' }
  )
);

// ---- Shared quiz storage ----

export const createSharedQuiz = onRequest(
  { secrets: [TURNSTILE_SECRET, ...NOTIFY_SECRETS] },
  withProtection(
    async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Use POST' });
        return;
      }
      const { questionsOutput, imageFilesDataURIs, inputText } = req.body ?? {};
      if (!questionsOutput || (!imageFilesDataURIs?.length && !inputText)) {
        res.status(400).json({
          success: false,
          error: '無效的 payload。需要 questionsOutput 與 imageFilesDataURIs 或 inputText 其中一個。',
        });
        return;
      }
      const approxBytes = Buffer.byteLength(JSON.stringify(req.body), 'utf8');
      if (approxBytes > MAX_PAYLOAD_BYTES) {
        res.status(413).json({
          success: false,
          error: `分享內容過大（約 ${Math.round(approxBytes / 1024)} KiB），超過 Firestore 1 MiB 上限。`,
        });
        return;
      }
      const quizId = generateUniqueId();
      // v0.3.0：老師專用金鑰只回給出題老師，資料庫只存雜湊
      const teacherKey = generateTeacherKey();
      const now = Date.now();
      const expiresAtMs = now + QUIZ_EXPIRY_MS;
      await db.collection(COLLECTION).doc(quizId).set({
        questionsOutput,
        imageFilesDataURIs: imageFilesDataURIs ?? [],
        inputText: inputText ?? '',
        teacherKeyHash: hashTeacherKey(teacherKey),
        createdAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(expiresAtMs),
      });
      // 失效時間（HH:mm 格式）
      const expiresHHMM = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(expiresAtMs));
      trackUsage('share-quiz');
      const studentUrl = `${SITE_BASE_URL}/quiz/?id=${quizId}`;
      // 學生分享連結建立成功通知（老師儀表板需老師金鑰，不放進通知）
      notifyAdminCard({
        status: 'success',
        title: '老師剛產生了學生分享連結',
        appName: APP_NAME,
        fields: [
          { icon: '📝', label: '標題', value: (questionsOutput as any)?.title ?? '—' },
          { icon: '🎯', label: '題數', value: `${(questionsOutput as any)?.questions?.length ?? 0} 題` },
          { icon: '⚖️', label: 'PIRLS', value: summarizePirlsDistribution((questionsOutput as any)?.questions ?? []) },
          { icon: '🆔', label: 'Quiz ID', value: quizId },
          { icon: '⏰', label: '失效於', value: `今天 ${expiresHHMM}（60 分鐘）` },
        ],
        actions: [
          { label: '👨‍🎓 開學生連結', uri: studentUrl, style: 'primary' },
        ],
      });
      res.json({ success: true, quizId, teacherKey });
    },
    { perMinute: 10, needTurnstile: false }
  )
);

// 學生端讀取，不限流也不要 Turnstile（純讀、量大、學生加入後 reload 也常見）
export const getSharedQuiz = onRequest(
  withCors(async (req, res) => {
    const quizId = (req.query?.quizId ?? req.query?.id) as string | undefined;
    if (!quizId) {
      res.status(400).json({ success: false, error: '缺少 quizId 參數。' });
      return;
    }
    const docRef = db.collection(COLLECTION).doc(quizId);
    const snap = await docRef.get();
    if (!snap.exists) {
      res.status(404).json({ success: false, error: '測驗不存在或已過期。' });
      return;
    }
    const data = snap.data() as any;
    const expiresAt = data.expiresAt?.toMillis?.() ?? 0;
    if (Date.now() > expiresAt) {
      await docRef.delete().catch(() => undefined);
      res.status(404).json({ success: false, error: '測驗不存在或已過期。' });
      return;
    }
    const { createdAt, expiresAt: _exp, ...rest } = stripTeacherSecrets(data);
    res.json({
      success: true,
      quizData: {
        ...rest,
        createdAt: createdAt?.toMillis?.() ?? null,
      },
    });
  })
);

// ---- B.16: 學生作答儀表板 ----

const SUBMISSIONS_COLLECTION = 'submissions';

/**
 * 學生交卷時呼叫。寫一筆紀錄到 submissions/{quizId}/students/{autoId}
 * 不要 Turnstile（學生量大），但加限流防一個學生灌爆
 */
export const submitQuizAnswer = onRequest(
  { secrets: [...NOTIFY_SECRETS] },
  withProtection(
    async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Use POST' });
        return;
      }
      const { quizId, studentInfo, answers, correctCount, totalCount, pirlsLevelStats, clientSubmissionId } = req.body ?? {};
      if (!quizId || !studentInfo || !Array.isArray(answers)) {
        res.status(400).json({ success: false, error: '缺少必要欄位 quizId / studentInfo / answers。' });
        return;
      }
      // 確認該 quiz 還沒過期才接受作答（避免污染舊資料）
      const quizSnap = await db.collection(COLLECTION).doc(quizId).get();
      if (!quizSnap.exists) {
        res.status(404).json({ success: false, error: '測驗不存在或已過期。' });
        return;
      }
      const quizData = quizSnap.data() as any;
      const quizExpiresAt = quizData.expiresAt?.toMillis?.() ?? 0;
      // 作答 doc TTL：跟測驗 + 7 天（讓老師事後也能看 dashboard）
      const submissionExpiresAt = Timestamp.fromMillis(quizExpiresAt + 7 * 24 * 60 * 60 * 1000);

      // v0.3.9：學生端帶交卷編號 → 用它當文件 ID，網路不穩重送時同一份作答只存一筆
      const studentsRef = db.collection(COLLECTION).doc(quizId).collection('students');
      const ref = isValidClientSubmissionId(clientSubmissionId) ? studentsRef.doc(clientSubmissionId) : studentsRef.doc();
      try {
        await ref.create({
          studentInfo,
          answers,
          correctCount: correctCount ?? 0,
          totalCount: totalCount ?? 0,
          pirlsLevelStats: pirlsLevelStats ?? {},
          submittedAt: Timestamp.now(),
          expiresAt: submissionExpiresAt,
          // 測驗本體 60 分鐘後會被清掉，作答紀錄自己也帶一份雜湊，老師 7 天內仍可驗證
          ...(typeof quizData.teacherKeyHash === 'string' ? { teacherKeyHash: quizData.teacherKeyHash } : {}),
        });
      } catch (err: any) {
        // 6 = ALREADY_EXISTS：上一次其實已經存進去了（只是回應沒傳回學生端），當作成功、不重複通知
        if (err?.code === 6) {
          res.json({ success: true, submissionId: ref.id, duplicate: true });
          return;
        }
        throw err;
      }
      trackUsage('submit-quiz');

      // v0.3.8：只在第 1 位與每滿 10 人時通知；其他交卷只數人數（count 查詢，不讀全班資料）
      const studentsCol = studentsRef;
      const countSnap = await studentsCol.count().get();
      const notifyKind = submissionNotifyKind(countSnap.data().count);
      if (!notifyKind) {
        res.json({ success: true, submissionId: ref.id });
        return;
      }

      // 讀取目前所有 submissions 計算班級即時統計
      const allSubsSnap = await studentsCol.get();
      const totalSubs = allSubsSnap.size;
      let classAvgAccuracy = 0;
      const aggregatePirls: Record<string, { correct: number; total: number }> = {};
      allSubsSnap.docs.forEach((d: QueryDocumentSnapshot) => {
        const x = d.data() as any;
        if (x.totalCount > 0) classAvgAccuracy += (x.correctCount / x.totalCount) * 100;
        Object.entries(x.pirlsLevelStats || {}).forEach(([level, s]: [string, any]) => {
          const acc = aggregatePirls[level] ?? { correct: 0, total: 0 };
          acc.correct += (s as any).correct;
          acc.total += (s as any).total;
          aggregatePirls[level] = acc;
        });
      });
      classAvgAccuracy = totalSubs > 0 ? classAvgAccuracy / totalSubs : 0;

      // 找班級弱項層次（答對率最低）
      const levelAccuracies = Object.entries(aggregatePirls)
        .filter(([_, s]) => s.total > 0)
        .map(([level, s]) => ({ level, accuracy: (s.correct / s.total) * 100 }));
      const weakest = levelAccuracies.sort((a, b) => a.accuracy - b.accuracy)[0];

      // 學生個人弱項
      const studentLevels = Object.entries(pirlsLevelStats ?? {})
        .filter(([_, s]) => (s as any).total > 0)
        .map(([level, s]) => ({ level, accuracy: ((s as any).correct / (s as any).total) * 100 }));
      const studentWeakest = studentLevels.sort((a, b) => a.accuracy - b.accuracy)[0];

      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      const quizTitle = quizData?.questionsOutput?.title ?? '—';

      const classWeakestInfo = weakest
        ? { label: PIRLS_LEVEL_LABEL[weakest.level] ?? weakest.level, accuracy: weakest.accuracy }
        : null;
      // v0.3.0：通知不帶學生姓名，也不放儀表板連結（儀表板需老師金鑰）
      if (notifyKind === 'first') {
        notifyAdminCard({
          status: 'success',
          title: `🟢 有班級開始交卷（之後每滿 ${SUBMISSION_NOTIFY_EVERY} 人通知一次）`,
          appName: APP_NAME,
          fields: buildSubmissionNotifyFields({
            quizId,
            quizTitle,
            studentInfo,
            correctCount,
            totalCount,
            accuracy,
            studentWeakest: studentWeakest
              ? { label: PIRLS_LEVEL_LABEL[studentWeakest.level] ?? studentWeakest.level, accuracy: studentWeakest.accuracy }
              : null,
            classAvgAccuracy,
            totalSubs,
            classWeakest: classWeakestInfo,
          }),
        });
      } else {
        notifyAdminCard({
          status: 'success',
          title: `📊 已有 ${totalSubs} 位學生交卷`,
          appName: APP_NAME,
          fields: buildMilestoneNotifyFields({ quizId, quizTitle, classAvgAccuracy, totalSubs, classWeakest: classWeakestInfo }),
        });
      }

      res.json({ success: true, submissionId: ref.id });
    },
    {
      // v0.3.9：全校平板共用同一個對外網路位址，改用「位址＋測驗代號」計數，每分鐘 60 份
      perMinute: SUBMIT_PER_MINUTE,
      needTurnstile: false,
      rateKey: (req, ip) => submitRateKey(ip, req.body?.quizId),
      rateLimitMessage: () => '同一時間交卷的人比較多，請等幾秒再送一次。',
    }
  )
);

/**
 * 老師端讀取某 quiz 的所有學生作答（聚合資料）。
 * v0.3.0：必須帶 Authorization: Bearer <老師金鑰>，學生改網址讀不到全班成績。
 * 金鑰 192 bits 無法暴力猜；不加 IP 限流，避免同校共用對外 IP 的老師互相擋到。
 */
export const getSubmissions = onRequest(
  withCors(async (req, res) => {
    const quizId = (req.query?.quizId ?? req.query?.id) as string | undefined;
    if (!quizId) {
      res.status(400).json({ success: false, error: '缺少 quizId 參數。' });
      return;
    }
    // 確認 quiz 仍存在
    const quizSnap = await db.collection(COLLECTION).doc(quizId).get();
    const quizData = quizSnap.exists ? (quizSnap.data() as any) : null;

    const subsSnap = await db.collection(COLLECTION).doc(quizId)
      .collection('students')
      .orderBy('submittedAt', 'desc')
      .get();

    const storedHashes = [
      quizData?.teacherKeyHash,
      ...subsSnap.docs.map((d: QueryDocumentSnapshot) => (d.data() as any).teacherKeyHash),
    ];
    if (!isTeacherKeyValid(storedHashes, extractTeacherKey(req.headers?.authorization))) {
      res.set('Cache-Control', 'no-store');
      res.status(403).json({
        success: false,
        error: '全班成績只有出題老師能看。請使用「分享測驗」視窗裡的「開啟儀表板」按鈕（老師專用連結）；學生作答連結無法查看全班成績。',
      });
      return;
    }

    const submissions = subsSnap.docs.map((d: QueryDocumentSnapshot) => {
      const x = d.data() as any;
      return {
        id: d.id,
        studentInfo: x.studentInfo,
        answers: x.answers,
        correctCount: x.correctCount,
        totalCount: x.totalCount,
        pirlsLevelStats: x.pirlsLevelStats,
        submittedAt: x.submittedAt?.toMillis?.() ?? null,
      };
    });

    // 微快取：5 秒。前端 polling 30 秒，所以不影響自動更新；
    // 但能擋掉「老師連按 5 下重新整理」「快速 reload」這類重複 Firestore 讀取。
    // private = 不准 CDN 共用快取（含學生姓名等個資）。
    res.set('Cache-Control', 'private, max-age=5');
    res.json({
      success: true,
      quizTitle: quizData?.questionsOutput?.title ?? null,
      questions: quizData?.questionsOutput?.questions ?? [],
      submissions,
    });
  })
);

// ---- B.27: 每週日 21:00 LINE 週報 ----

/**
 * Cloud Scheduler 自動觸發。每週日 21:00 Asia/Taipei 推 LINE 卡片給管理員。
 */
export const weeklyDigest = onSchedule(
  {
    schedule: '0 21 * * 0',
    timeZone: 'Asia/Taipei',
    region: 'asia-east1',
    secrets: [...NOTIFY_SECRETS],
  },
  async () => {
    const result = await runWeeklyDigest();
    console.log('[weeklyDigest] sent', JSON.stringify(result));
  }
);

// ---- B.26: 老師端 Admin Dashboard ----

/** 從 Authorization: Bearer xxx 或 ?key=xxx 解析 admin key */
function getAdminKey(req: Request): string | null {
  const auth = (req.headers?.authorization ?? '') as string;
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return ((req.query?.key ?? '') as string) || null;
}

function isAdminAuthorized(req: Request): boolean {
  const key = getAdminKey(req);
  const expected = process.env.PIRLS_ADMIN_KEY?.trim();
  return Boolean(key && expected && key === expected);
}

/**
 * 老師端 admin dashboard 資料 endpoint。
 * Bearer token 授權，回傳過去 30 天聚合統計 + 班級層次答對率。
 */
export const getAdminStats = onRequest(
  { secrets: [PIRLS_ADMIN_KEY] },
  withCors(async (req, res) => {
    // 速率限制：每 IP 每分鐘最多 5 次（即使 admin key 弱也擋暴力破解）
    const ip = getClientIp(req);
    const limit = await checkRateLimit(`admin-${ip}`, { perMinute: 5 });
    if (!limit.allowed) {
      res.status(429).json({ success: false, error: '嘗試過於頻繁，請稍候再試。' });
      return;
    }
    if (!isAdminAuthorized(req)) {
      res.status(403).json({ success: false, error: '未授權' });
      return;
    }

    // 1. 過去 30 天每日 usage
    const dailyStats = await getRecentUsage(30);

    // 2. 全部 submissions 聚合（含已過期的，只要 doc 還在）
    // 用單純 limit（無 orderBy）避免 collection-group index 需求；
    // admin dashboard 只做聚合統計，不需排序順序。
    const subsSnap = await db
      .collectionGroup('students')
      .limit(500)
      .get();

    let totalSubmissions = 0;
    let totalAccuracy = 0;
    let accuracyCount = 0;
    const aggregatePirls: Record<string, { correct: number; total: number }> = {};

    subsSnap.docs.forEach((d: QueryDocumentSnapshot) => {
      const x = d.data() as any;
      totalSubmissions += 1;
      if (x.totalCount > 0) {
        totalAccuracy += (x.correctCount / x.totalCount) * 100;
        accuracyCount += 1;
      }
      Object.entries(x.pirlsLevelStats || {}).forEach(([level, s]: [string, any]) => {
        const acc = aggregatePirls[level] ?? { correct: 0, total: 0 };
        acc.correct += s.correct;
        acc.total += s.total;
        aggregatePirls[level] = acc;
      });
    });

    const avgAccuracy = accuracyCount > 0 ? totalAccuracy / accuracyCount : null;
    const pirlsBreakdown = Object.entries(aggregatePirls).map(([level, s]) => ({
      level,
      accuracy: s.total > 0 ? (s.correct / s.total) * 100 : 0,
      total: s.total,
    }));

    // 3. 過去 30 天總計
    const totals = dailyStats.reduce(
      (acc: any, day: any) => ({
        imageGen: acc.imageGen + (day['generate-images'] ?? 0),
        textGen: acc.textGen + (day['generate-text'] ?? 0),
        imageGenFailed: acc.imageGenFailed + (day['generate-images-failed'] ?? 0),
        textGenFailed: acc.textGenFailed + (day['generate-text-failed'] ?? 0),
        shares: acc.shares + (day['share-quiz'] ?? 0),
        submits: acc.submits + (day['submit-quiz'] ?? 0),
      }),
      { imageGen: 0, textGen: 0, imageGenFailed: 0, textGenFailed: 0, shares: 0, submits: 0 }
    );

    res.json({
      success: true,
      dailyStats,
      totals,
      totalSubmissions,
      avgAccuracy,
      pirlsBreakdown,
      generatedAt: Date.now(),
    });
  })
);

/**
 * 手動觸發版（給管理員測試用）。
 * 需帶 ?adminKey=xxx，與 PIRLS_LINE_ADMIN_USER_ID 比對（沿用既有 secret 簡單授權）。
 *
 * 範例：curl 'https://...cloudfunctions.net/triggerWeeklyDigestNow?adminKey=U183cf...'
 */
export const triggerWeeklyDigestNow = onRequest(
  { secrets: [...NOTIFY_SECRETS] },
  withCors(async (req, res) => {
    const provided = (req.query?.adminKey ?? '') as string;
    const expected = process.env.PIRLS_LINE_ADMIN_USER_ID?.trim() ?? '';
    if (!provided || provided !== expected) {
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const result = await runWeeklyDigest();
    res.json({ success: true, result });
  })
);
