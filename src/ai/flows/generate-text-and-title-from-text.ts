// src/ai/flows/generate-text-and-title-from-text.ts
'use server';

/**
 * @fileOverview Generates a suitable title for a given text content.
 *
 * - generateTextAndTitleFromText - A function that creates a title from text.
 * - GenerateTextAndTitleFromTextInput - The input type for the function.
 * - GenerateTextAndTitleFromTextOutput - The output type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTextAndTitleFromTextInputSchema = z.object({
  text: z.string().describe("The article content to be analyzed."),
});
export type GenerateTextAndTitleFromTextInput = z.infer<typeof GenerateTextAndTitleFromTextInputSchema>;


const GenerateTextAndTitleFromTextOutputSchema = z.object({
  title: z.string().describe('根據提供的文章內容，生成一個簡潔且最貼切的標題。'),
  articleContent: z.string().describe('回傳未經修改的原始文章內容。'),
});
export type GenerateTextAndTitleFromTextOutput = z.infer<typeof GenerateTextAndTitleFromTextOutputSchema>;

export async function generateTextAndTitleFromText(
  input: GenerateTextAndTitleFromTextInput
): Promise<GenerateTextAndTitleFromTextOutput> {
  return generateTextAndTitleFromTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTextAndTitleFromTextPrompt',
  model: 'googleai/gemini-2.0-flash-lite',
  input: {schema: GenerateTextAndTitleFromTextInputSchema},
  output: {schema: GenerateTextAndTitleFromTextOutputSchema},
  prompt: `您是一位專業的編輯，專長是為文章下一個最精準的標題。

您的任務是根據下方提供的「文章內容」，生成一個最能代表文章主旨、簡潔且吸引人的「標題」。

**重要指令：**
- 您生成的標題必須與文章內容緊密相關。
- 標題需簡潔有力。
- 在 \`articleContent\` 欄位中，您必須回傳「完整且未經修改」的原始文章內容。

提供的文章內容如下：
---
{{{text}}}
---

請開始您的編輯工作，確保輸出的結果符合指定的JSON結構。
  `,
});

const generateTextAndTitleFromTextFlow = ai.defineFlow(
  {
    name: 'generateTextAndTitleFromTextFlow',
    inputSchema: GenerateTextAndTitleFromTextInputSchema,
    outputSchema: GenerateTextAndTitleFromTextOutputSchema,
  },
  async (input) => {
    // For this flow, we simply pass the input to the prompt.
    // The prompt is designed to generate a title and return the original text.
    const {output} = await prompt(input);
    return output!;
  }
);
