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
  model: 'googleai/gemini-2.0-flash-lite',
  input: {schema: GenerateTextAndTitleFromImagesInputSchema},
  output: {schema: GenerateTextAndTitleFromImagesOutputSchema},
  prompt: `您是一位優秀的編輯，專精於從圖片中辨識文字並為其內容做出精準的摘要。

您的任務分為兩部分：
1.  **文字提取與重組**：請仔細辨識「所有」提供的圖片，將其中包含的「所有文字內容」完整地提取出來。
2.  **內容優化與分段**：接著，最重要的一步是，根據上下文語意，將因換行而斷裂的句子和段落重新連接，並根據文章的邏輯結構在適當的位置加上換行，組合成一篇「**分段清晰、通順連貫、符合邏輯且易於閱讀的完整文章**」。
3.  **標題生成**：根據您剛剛重組好的完整文章內容，生成一個最能代表文章主旨、簡潔且吸引人的「標題」。

**重要指令：**
-   當提供多張圖片時，請將它們視為一個**連續、完整的文本**來處理。
-   輸出的 \`articleContent\` 必須是經過您編輯重組後，流暢通順且**已分段**的純文字文章。
-   輸出的 \`title\` 必須是一個簡短的標題。

提供的圖片內容如下：
{{#each photoDataUris}}{{media url=this}}{{/each}}

請確保輸出的結果是一個有效的JSON物件，且其結構需符合指定的輸出結構描述。
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
