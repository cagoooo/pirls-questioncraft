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
import { checkRateLimit, getClientIp } from './rate-limit';
import { verifyTurnstile } from './turnstile';
import { notifyAdminCard } from './notify-line';
import { trackUsage, getRecentUsage } from './usage-tracker';
import { runWeeklyDigest } from './weekly-digest';

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

/** 加速率限制 + Turnstile 驗證的中介層，包在 AI 出題類 endpoint 上 */
function withProtection(
  handler: (req: Request, res: Response) => Promise<void> | void,
  opts: { perMinute?: number; needTurnstile?: boolean } = {}
) {
  const { perMinute = 5, needTurnstile = true } = opts;
  return withCors(async (req, res) => {
    const ip = getClientIp(req);
    const limit = await checkRateLimit(ip, { perMinute });
    if (!limit.allowed) {
      res.status(429).json({
        success: false,
        error: `請求過於頻繁，請稍候再試（${perMinute} 次/分鐘上限）。`,
        resetAt: limit.resetAt,
      });
      return;
    }
    if (needTurnstile) {
      const verify = await verifyTurnstile(req, process.env.TURNSTILE_SECRET, ip);
      if (!verify.ok) {
        res.status(403).json({ success: false, error: verify.reason });
        return;
      }
    }
    await handler(req, res);
  });
}

/** 取要監看的 secrets（給 onRequest 的 secrets 陣列用） */
const NOTIFY_SECRETS = [
  PIRLS_LINE_CHANNEL_ACCESS_TOKEN,
  PIRLS_LINE_ADMIN_USER_ID,
  GOOGLE_CHAT_WEBHOOK_URL
];

// ---- AI flows ----

export const generateFromImages = onRequest(
  { secrets: [GEMINI_API_KEY, TURNSTILE_SECRET, ...NOTIFY_SECRETS] },
  withProtection(
    async (req, res) => {
      const t0 = Date.now();
      const ip = getClientIp(req);
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Use POST' });
        return;
      }
      const { photoDataUris, questionMode, languageMode } = req.body ?? {};
      if (!Array.isArray(photoDataUris) || photoDataUris.length === 0) {
        res.status(400).json({ success: false, error: 'photoDataUris 不可為空。' });
        return;
      }
      try {
        const result = await runGenerateFromImages({ photoDataUris, questionMode, languageMode });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        trackUsage('generate-images');
        // 估圖片總大小（base64 ≈ 4/3 原始 bytes）
        const estKB = Math.round(photoDataUris.reduce((sum, d) => sum + d.length, 0) * 0.75 / 1024);
        notifyAdminCard({
          status: 'success',
          title: '有人剛完成圖片出題',
          appName: APP_NAME,
          fields: [
            { icon: '📷', label: '圖片', value: `${photoDataUris.length} 張（${estKB} KB）` },
            { icon: '📝', label: '標題', value: result.title },
            { icon: '📏', label: '文章', value: `${result.articleContent.length} 字` },
            { icon: '🎯', label: '題數', value: questionMode === '10-questions' ? '10 題' : '8 題' },
            { icon: '⚖️', label: 'PIRLS', value: summarizePirlsDistribution(result.questions) },
            { icon: '🌐', label: '語言', value: languageMode === 'en' ? 'English' : '繁體中文' },
            { icon: '🌍', label: '來源', value: ip },
            { icon: '⏱️', label: '耗時', value: `${elapsed}s` },
          ],
          body: `📖 文章摘要\n${summarizeText(result.articleContent, 100)}`,
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
            { icon: '📷', label: '圖片', value: `${photoDataUris.length} 張` },
            { icon: '🌍', label: '來源', value: ip },
            { icon: '💬', label: '錯誤', value: (e?.message ?? String(e)).slice(0, 250) },
          ],
          footerNote: `⏱️ ${elapsed}s`,
        });
        throw e;
      }
    },
    { perMinute: 5 }
  )
);

export const generateFromText = onRequest(
  { secrets: [GEMINI_API_KEY, TURNSTILE_SECRET, ...NOTIFY_SECRETS] },
  withProtection(
    async (req, res) => {
      const t0 = Date.now();
      const ip = getClientIp(req);
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Use POST' });
        return;
      }
      const { text, questionMode, languageMode } = req.body ?? {};
      if (typeof text !== 'string' || text.trim().length === 0) {
        res.status(400).json({ success: false, error: 'text 不可為空。' });
        return;
      }
      try {
        const result = await runGenerateFromText({ text, questionMode, languageMode });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        trackUsage('generate-text');
        notifyAdminCard({
          status: 'success',
          title: '有人剛完成文字出題',
          appName: APP_NAME,
          fields: [
            { icon: '📝', label: '標題', value: result.title },
            { icon: '📏', label: '字數', value: `${text.length}` },
            { icon: '🎯', label: '題數', value: questionMode === '10-questions' ? '10 題' : '8 題' },
            { icon: '⚖️', label: 'PIRLS', value: summarizePirlsDistribution(result.questions) },
            { icon: '🌐', label: '語言', value: languageMode === 'en' ? 'English' : '繁體中文' },
            { icon: '🌍', label: '來源', value: ip },
            { icon: '⏱️', label: '耗時', value: `${elapsed}s` },
          ],
          body: `📖 文章摘要\n${summarizeText(text, 100)}`,
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
            { icon: '📏', label: '字數', value: `${text.length}` },
            { icon: '🌍', label: '來源', value: ip },
            { icon: '💬', label: '錯誤', value: (e?.message ?? String(e)).slice(0, 250) },
          ],
          footerNote: `⏱️ ${elapsed}s`,
        });
        throw e;
      }
    },
    { perMinute: 5 }
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
      const now = Date.now();
      const expiresAtMs = now + QUIZ_EXPIRY_MS;
      await db.collection(COLLECTION).doc(quizId).set({
        questionsOutput,
        imageFilesDataURIs: imageFilesDataURIs ?? [],
        inputText: inputText ?? '',
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
      const dashboardUrl = `${SITE_BASE_URL}/dashboard/?id=${quizId}`;
      // 學生分享連結建立成功通知（含 2 顆可點按鈕）
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
          { label: '📊 老師儀表板', uri: dashboardUrl, style: 'secondary' },
        ],
      });
      res.json({ success: true, quizId });
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
    const { createdAt, expiresAt: _exp, ...rest } = data;
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
      const { quizId, studentInfo, answers, correctCount, totalCount, pirlsLevelStats } = req.body ?? {};
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

      const ref = await db.collection(COLLECTION).doc(quizId)
        .collection('students').add({
          studentInfo,
          answers,
          correctCount: correctCount ?? 0,
          totalCount: totalCount ?? 0,
          pirlsLevelStats: pirlsLevelStats ?? {},
          submittedAt: Timestamp.now(),
          expiresAt: submissionExpiresAt,
        });
      trackUsage('submit-quiz');

      // 讀取目前所有 submissions 計算班級即時統計
      const allSubsSnap = await db.collection(COLLECTION).doc(quizId)
        .collection('students').get();
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
      const accIcon = accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '📚';
      const dashboardUrl = `${SITE_BASE_URL}/dashboard/?id=${quizId}`;
      const quizTitle = (await db.collection(COLLECTION).doc(quizId).get()).data()?.questionsOutput?.title ?? '—';

      notifyAdminCard({
        status: 'success',
        title: `${accIcon} 第 ${totalSubs} 位學生剛交卷`,
        appName: APP_NAME,
        fields: [
          { icon: '📝', label: '測驗', value: quizTitle },
          { icon: '👤', label: '學生', value: `${studentInfo.class} ${studentInfo.seatNumber}號 ${studentInfo.name}` },
          { icon: '✅', label: '答對', value: `${correctCount} / ${totalCount}（${accuracy}%）` },
          ...(studentWeakest
            ? [{ icon: '⚠️', label: '個人弱項', value: `${PIRLS_LEVEL_LABEL[studentWeakest.level] ?? studentWeakest.level}（${Math.round(studentWeakest.accuracy)}%）` }]
            : []),
          { icon: '🏫', label: '班級平均', value: `${classAvgAccuracy.toFixed(1)}%（${totalSubs} 人）` },
          ...(weakest
            ? [{ icon: '🎯', label: '班級弱項', value: `${PIRLS_LEVEL_LABEL[weakest.level] ?? weakest.level}（${Math.round(weakest.accuracy)}%）` }]
            : []),
        ],
        actions: [
          { label: '📊 看完整儀表板', uri: dashboardUrl, style: 'primary' },
        ],
      });

      res.json({ success: true, submissionId: ref.id });
    },
    { perMinute: 5, needTurnstile: false }
  )
);

/**
 * 老師端讀取某 quiz 的所有學生作答（聚合資料）。
 * 純讀，不限流（老師可能 reload 看即時數字）。
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
