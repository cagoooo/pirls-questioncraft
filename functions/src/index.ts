// functions/src/index.ts
// 4 個 HTTPS Cloud Functions endpoint：
//  - generateFromImages   POST  圖片陣列 → 題組（要 Turnstile + 限流）
//  - generateFromText     POST  純文字 → 題組（要 Turnstile + 限流）
//  - createSharedQuiz     POST  存共享測驗到 Firestore（要限流，不需 Turnstile）
//  - getSharedQuiz        GET   依 quizId 取共享測驗（不限流，學生端純讀）
// 全部成功/失敗都會 LINE 推卡片給管理員（B.14）。

import { onRequest, type Request } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import corsLib from 'cors';
import type { Response } from 'express';

import { runGenerateFromImages } from './flows/generate-from-images';
import { runGenerateFromText } from './flows/generate-from-text';
import { checkRateLimit, getClientIp } from './rate-limit';
import { verifyTurnstile } from './turnstile';
import { notifyAdminCard } from './notify-line';

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

const APP_NAME = 'PIRLS 題組生成站';
const COLLECTION = 'sharedQuizzes';
const QUIZ_EXPIRY_MS = 60 * 60 * 1000;
const MAX_PAYLOAD_BYTES = 900 * 1024;

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
const LINE_SECRETS = [PIRLS_LINE_CHANNEL_ACCESS_TOKEN, PIRLS_LINE_ADMIN_USER_ID];

// ---- AI flows ----

export const generateFromImages = onRequest(
  { secrets: [GEMINI_API_KEY, TURNSTILE_SECRET, ...LINE_SECRETS] },
  withProtection(
    async (req, res) => {
      const t0 = Date.now();
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
        notifyAdminCard({
          status: 'success',
          title: '有人剛完成圖片出題',
          appName: APP_NAME,
          fields: [
            { icon: '📷', label: '圖片', value: `${photoDataUris.length} 張` },
            { icon: '📝', label: '標題', value: result.title },
            { icon: '🎯', label: '題數', value: questionMode === '10-questions' ? '10 題' : '8 題' },
            { icon: '🌐', label: '語言', value: languageMode === 'en' ? 'English' : '繁體中文' },
            { icon: '⏱️', label: '耗時', value: `${elapsed}s` },
          ],
        });
        res.json({ success: true, data: result });
      } catch (e: any) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        notifyAdminCard({
          status: 'failed',
          title: '圖片出題失敗',
          appName: APP_NAME,
          fields: [
            { icon: '📷', label: '圖片', value: `${photoDataUris.length} 張` },
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
  { secrets: [GEMINI_API_KEY, TURNSTILE_SECRET, ...LINE_SECRETS] },
  withProtection(
    async (req, res) => {
      const t0 = Date.now();
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
        notifyAdminCard({
          status: 'success',
          title: '有人剛完成文字出題',
          appName: APP_NAME,
          fields: [
            { icon: '📝', label: '標題', value: result.title },
            { icon: '📏', label: '字數', value: `${text.length}` },
            { icon: '🎯', label: '題數', value: questionMode === '10-questions' ? '10 題' : '8 題' },
            { icon: '🌐', label: '語言', value: languageMode === 'en' ? 'English' : '繁體中文' },
            { icon: '⏱️', label: '耗時', value: `${elapsed}s` },
          ],
        });
        res.json({ success: true, data: result });
      } catch (e: any) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        notifyAdminCard({
          status: 'failed',
          title: '文字出題失敗',
          appName: APP_NAME,
          fields: [
            { icon: '📏', label: '字數', value: `${text.length}` },
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
  { secrets: [TURNSTILE_SECRET, ...LINE_SECRETS] },
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
      await db.collection(COLLECTION).doc(quizId).set({
        questionsOutput,
        imageFilesDataURIs: imageFilesDataURIs ?? [],
        inputText: inputText ?? '',
        createdAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + QUIZ_EXPIRY_MS),
      });
      // 學生分享連結建立成功通知
      notifyAdminCard({
        status: 'success',
        title: '老師剛產生了學生分享連結',
        appName: APP_NAME,
        fields: [
          { icon: '🆔', label: 'Quiz ID', value: quizId },
          { icon: '📝', label: '標題', value: (questionsOutput as any)?.title ?? '—' },
          { icon: '🎯', label: '題數', value: `${(questionsOutput as any)?.questions?.length ?? 0} 題` },
          { icon: '⏰', label: '有效期', value: '60 分鐘' },
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
