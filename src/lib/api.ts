// src/lib/api.ts
// 前端統一打 Cloud Functions 的 fetch wrapper。
// 路線 B 後，原本 import 的 Server Action 都改用本檔的函式。

// 與 functions/src/flows/generate-from-images.ts 中的 OutputSchema 對齊
export interface PirlsQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
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
}
type ApiRes<T> = ApiOk<T> | ApiErr;

async function postJSON<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: ApiRes<T> = await res.json().catch(() => ({
    success: false,
    error: `伺服器回應非 JSON（${res.status}）`,
  })) as ApiRes<T>;
  if (!res.ok || !json.success) {
    throw new Error('error' in json ? json.error : `HTTP ${res.status}`);
  }
  return (json.data ?? (json as any)) as T;
}

async function getJSON<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json: ApiRes<T> = await res.json().catch(() => ({
    success: false,
    error: `伺服器回應非 JSON（${res.status}）`,
  })) as ApiRes<T>;
  if (!res.ok || !json.success) {
    throw new Error('error' in json ? json.error : `HTTP ${res.status}`);
  }
  return (json as any) as T;
}

export interface GenerateFromImagesArgs {
  photoDataUris: string[];
  questionMode: '8-questions' | '10-questions';
  languageMode: 'zh-TW' | 'en';
}

export interface GenerateFromTextArgs {
  text: string;
  questionMode: '8-questions' | '10-questions';
  languageMode: 'zh-TW' | 'en';
}

export async function generatePirlsQuestions(
  args: GenerateFromImagesArgs
): Promise<GeneratePirlsQuestionsOutput> {
  return postJSON<GeneratePirlsQuestionsOutput>('generateFromImages', args);
}

export async function generatePirlsQuestionsFromText(
  args: GenerateFromTextArgs
): Promise<GeneratePirlsQuestionsOutput> {
  return postJSON<GeneratePirlsQuestionsOutput>('generateFromText', args);
}

export interface CreateSharedQuizArgs {
  questionsOutput: GeneratePirlsQuestionsOutput;
  imageFilesDataURIs?: string[];
  inputText?: string;
}

export async function createSharedQuiz(args: CreateSharedQuizArgs): Promise<{ quizId: string }> {
  const r = await postJSON<{ quizId: string }>('createSharedQuiz', args);
  // postJSON 已經把外層拆掉，這裡 r 就是 { quizId }
  return r as any;
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
