
// src/ai/flows/generate-text-and-title-from-images.ts
'use server';

/**
 * @fileOverview Extracts text content from images and generates a suitable title.
 *
 * - generateTextAndTitleFromImages - A function that performs OCR on images and creates a title.
 * - GenerateTextAndTitleFromImagesInput - The input type for the function.
 * - GenerateTextAndTitleFromImagesOutput - The output type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTextAndTitleFromImagesInputSchema = z.object({
  photoDataUris: z.array(z.string()).describe(
    "An array of photos of the text to be used, as data URIs. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
  ),
});
export type GenerateTextAndTitleFromImagesInput = z.infer<typeof GenerateTextAndTitleFromImagesInputSchema>;


const GenerateTextAndTitleFromImagesOutputSchema = z.object({
  title: z.string().describe('根據提取出的文章內容，生成一個簡潔貼切的標題。'),
  articleContent: z.string().describe('從圖片中完整提取出的所有文字內容，並已重組成一篇通順、流暢、且已分段的文章。'),
});
export type GenerateTextAndTitleFromImagesOutput = z.infer<typeof GenerateTextAndTitleFromImagesOutputSchema>;

export async function generateTextAndTitleFromImages(
  input: GenerateTextAndTitleFromImagesInput
): Promise<GenerateTextAndTitleFromImagesOutput> {
  return generateTextAndTitleFromImagesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTextAndTitleFromImagesPrompt',
  model: 'googleai/gemini-pro-vision',
  input: {schema: GenerateTextAndTitleFromImagesInputSchema},
  output: {schema: GenerateTextAndTitleFromImagesOutputSchema},
  prompt: `您是一位資深的國文老師與專業編輯，專長是將圖片中的文字轉換成一篇高品質、結構完整的閱讀測驗文章。

您的核心任務有三個，請嚴格依序執行：

1.  **文字提取與校正**：
    *   請仔細辨識**「所有」**提供的圖片，將其中包含的**「所有文字內容」**完整地提取出來。
    *   您必須根據上下文語意，將因掃描或換行而斷裂的句子**重新連接**，修正明顯的辨識錯字，使其成為通順的語句。

2.  **文章重組與分段**：
    *   這是最重要的步驟。您必須將校正後的文字，根據文章的**內在邏輯與結構**，劃分成**「意義完整且內容豐富」**的數個段落。
    *   **絕不可**輸出未經整理、句子零碎、或僅是簡單拼接的文字。輸出的 \`articleContent\` 必須是一篇**「分段清晰、通順連貫、符合邏輯且易於閱讀的完整文章」**。

3.  **標題生成**：
    *   最後，請根據您**「最終潤飾完成」**的完整文章內容，生成一個最能代表文章主旨、簡潔且吸引人的「標題」。

**重要指令：**
-   當提供多張圖片時，請務必將它們視為一個**連續、完整的文本**來處理，並整合所有內容。
-   輸出的結果必須嚴格符合指定的JSON結構，包含 \`title\` 和 \`articleContent\` 兩個欄位。

提供的圖片內容如下：
{{#each photoDataUris}}{{media url=this}}{{/each}}

請開始您的編輯工作，確保輸出一篇高品質的文章。
  `,
});

const generateTextAndTitleFromImagesFlow = ai.defineFlow(
  {
    name: 'generateTextAndTitleFromImagesFlow',
    inputSchema: GenerateTextAndTitleFromImagesInputSchema,
    outputSchema: GenerateTextAndTitleFromImagesOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
