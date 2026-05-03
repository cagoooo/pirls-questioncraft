// functions/src/index.ts
// 4 個 HTTPS Cloud Functions endpoint：
//  - generateFromImages   POST  圖片陣列 → 題組
//  - generateFromText     POST  純文字 → 題組
//  - createSharedQuiz     POST  存共享測驗到 Firestore
//  - getSharedQuiz        GET   依 quizId 取共享測驗
//
// CORS 寬鬆放行，因為 GitHub Pages 域名 / 自訂網域 / localhost 都會打進來。
// 若想收緊，把下面 ALLOWED_ORIGINS 改成顯式清單。

import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import corsLib from 'cors';

import { runGenerateFromImages } from './flows/generate-from-images';
import { runGenerateFromText } from './flows/generate-from-text';

initializeApp();
const db = getFirestore();

const cors = corsLib({ origin: true });

// 預設 region 與資源
setGlobalOptions({
  region: 'asia-east1',
  maxInstances: 10,
  // 圖片題組可能 5MB+，調高一些 memory 與 timeout
  memory: '1GiB',
  timeoutSeconds: 120,
});

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const COLLECTION = 'sharedQuizzes';
const QUIZ_EXPIRY_MS = 60 * 60 * 1000; // 1 小時
const MAX_PAYLOAD_BYTES = 900 * 1024;

function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 12) + Date.now().toString(36).substring(4);
}

function withCors(handler: (req: any, res: any) => Promise<void> | void) {
  return (req: any, res: any) =>
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

// ---- AI flows ----

export const generateFromImages = onRequest(
  { secrets: [GEMINI_API_KEY] },
  withCors(async (req, res) => {
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
  })
);

export const generateFromText = onRequest(
  { secrets: [GEMINI_API_KEY] },
  withCors(async (req, res) => {
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
  })
);

// ---- Shared quiz storage ----

export const createSharedQuiz = onRequest(
  withCors(async (req, res) => {
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
        error: `分享內容過大（約 ${Math.round(approxBytes / 1024)} KiB），超過 Firestore 1 MiB 上限。請減少圖片數量或改純文字模式。`,
      });
      return;
    }
    const quizId = generateUniqueId();
    const now = Date.now();
    await db
      .collection(COLLECTION)
      .doc(quizId)
      .set({
        questionsOutput,
        imageFilesDataURIs: imageFilesDataURIs ?? [],
        inputText: inputText ?? '',
        createdAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + QUIZ_EXPIRY_MS),
      });
    res.json({ success: true, quizId });
  })
);

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

// 避免「FieldValue 未使用」TS warning（保留 import 給後續擴充使用）
void FieldValue;
