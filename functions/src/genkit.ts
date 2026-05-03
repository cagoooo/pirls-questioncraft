import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// 注意：在 Cloud Functions 內，GEMINI_API_KEY 由 defineSecret() 注入到 process.env，
// genkit 的 googleAI() plugin 會自動讀取此環境變數。
export const ai = genkit({
  plugins: [googleAI()],
});
