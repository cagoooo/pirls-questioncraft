// functions/src/index.ts
// 4 個 HTTPS Cloud Functions endpoint：
//  - generateFromImages   POST  圖片陣列 → 題組（要 Turnstile + 限流）
//  - generateFromText     POST  純文字 → 題組（要 Turnstile + 限流）
//  - createSharedQuiz     POST  存共享測驗到 Firestore（要限流，不需 Turnstile）
//  - getSharedQuiz        GET   依 quizId 取共享測驗（不限流，學生端純讀）

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
    // 1. IP 速率限制
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

    // 2. Turnstile 人機驗證（secret 未設時自動跳過）
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

// ---- AI flows ----

export const generateFromImages = onRequest(
  { secrets: [GEMINI_API_KEY, TURNSTILE_SECRET] },
  withProtection(
    async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Use POST' });
        return;
      }
      const { photoDataUris, questionMode, languageMode } = req.body ?? {};
      if (!Array.isArray(photoDataUris) || photoDataUris.length === 0) {
        res.status(400).json({ success: false, error: 'photoDataUris 不可為空。' });
        return;
      }
      const result = await runGenerateFromImages({ photoDataUris, questionMode, languageMode });
      res.json({ success: true, data: result });
    },
    { perMinute: 5 } // 出題操作貴，每 IP 每分鐘最多 5 次
  )
);

export const generateFromText = onRequest(
  { secrets: [GEMINI_API_KEY, TURNSTILE_SECRET] },
  withProtection(
    async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Use POST' });
        return;
      }
      const { text, questionMode, languageMode } = req.body ?? {};
      if (typeof text !== 'string' || text.trim().length === 0) {
        res.status(400).json({ success: false, error: 'text 不可為空。' });
        return;
      }
      const result = await runGenerateFromText({ text, questionMode, languageMode });
      res.json({ success: true, data: result });
    },
    { perMinute: 5 }
  )
);

// ---- Shared quiz storage ----

export const createSharedQuiz = onRequest(
  { secrets: [TURNSTILE_SECRET] },
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
      res.json({ success: true, quizId });
    },
    // 分享動作便宜，但仍要限流防腳本灌爆 Firestore
    // 不要 Turnstile（已在出題階段驗過）
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
