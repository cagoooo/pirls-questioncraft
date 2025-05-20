// src/app/api/share/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';

// 簡單的記憶體內儲存
interface QuizPayload {
  questionsOutput: GeneratePirlsQuestionsOutput;
  imageFilesDataURIs: string[];
  createdAt: number;
}

// 這個儲存區會在伺服器重啟或新部署時重設。
// 在 Vercel (無伺服器) 環境中，每個函式調用可能會有自己的儲存實例，
// 這意味著一個調用儲存的測驗可能無法被另一個調用檢索到，除非平台有一定的實例重用或粘性會話機制，這無法保證。
const tempQuizStore = new Map<string, QuizPayload>();
const QUIZ_EXPIRY_MS = 60 * 60 * 1000; // 1 小時 (例如)

function cleanupExpiredQuizzes() {
  const now = Date.now();
  for (const [key, quiz] of tempQuizStore.entries()) {
    if (now - quiz.createdAt > QUIZ_EXPIRY_MS) {
      tempQuizStore.delete(key);
      console.log(`Temporary quiz ${key} expired and removed.`);
    }
  }
}

// 基本的唯一 ID 生成器 (僅供演示，生產環境請考慮更健壯的方案)
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 12) + Date.now().toString(36).substring(4);
}

export async function POST(request: NextRequest) {
  cleanupExpiredQuizzes(); 
  try {
    const body = await request.json();
    const { questionsOutput, imageFilesDataURIs } = body;

    if (!questionsOutput || !imageFilesDataURIs || !Array.isArray(imageFilesDataURIs)) {
      return NextResponse.json({ success: false, error: 'Missing or invalid questionsOutput or imageFilesDataURIs.' }, { status: 400 });
    }

    const quizId = generateUniqueId();
    tempQuizStore.set(quizId, {
      questionsOutput,
      imageFilesDataURIs,
      createdAt: Date.now(),
    });

    // console.log(`Quiz ${quizId} stored temporarily. Store size: ${tempQuizStore.size}`);
    return NextResponse.json({ success: true, quizId });
  } catch (error) {
    console.error('Error storing temporary quiz:', error);
    return NextResponse.json({ success: false, error: 'Failed to store quiz data.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  cleanupExpiredQuizzes();
  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get('quizId');

  if (!quizId) {
    return NextResponse.json({ success: false, error: 'Missing quizId parameter.' }, { status: 400 });
  }

  const quizData = tempQuizStore.get(quizId);

  if (quizData) {
    // 再次檢查有效期，以防 cleanup 未及時運行
    if (Date.now() - quizData.createdAt > QUIZ_EXPIRY_MS) {
      tempQuizStore.delete(quizId);
      // console.log(`Attempted to access expired quiz ${quizId}. Removed.`);
      return NextResponse.json({ success: false, error: 'Quiz not found or has expired.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, quizData });
  } else {
    return NextResponse.json({ success: false, error: 'Quiz not found or has expired.' }, { status: 404 });
  }
}
