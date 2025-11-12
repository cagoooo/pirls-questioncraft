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
  articleContent: z.string().describe('從圖片中完整提取出的所有文字內容。'),
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
1.  **文字提取**：請仔細辨識「所有」提供的圖片，將其中包含的「所有文字內容」一字不漏地、完整地提取出來，並將它們整合成一篇通順且連貫的文章。請確保內容的完整性和順序的正確性。
2.  **標題生成**：根據您剛剛提取出的完整文章內容，生成一個最能代表文章主旨、簡潔且吸引人的「標題」。

**重要指令：**
-   當提供多張圖片時，請將它們視為一個**連續、完整的文本**來處理。
-   輸出的 \`articleContent\` 必須是從圖片中提取出的純文字內容。
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
