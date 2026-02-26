// src/ai/flows/generate-pirls-questions-from-text.ts
'use server';

/**
 * @fileOverview Generates PIRLS-style multiple-choice questions and a title from text content.
 *
 * - generatePirlsQuestionsFromText - A function that generates PIRLS questions and a title from text.
 * - GeneratePirlsQuestionsFromTextInput - The input type for the function.
 * - GeneratePirlsQuestionsOutput - The output type for the function (shared with image flow).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
// Import the unified output type
import type { GeneratePirlsQuestionsOutput } from './generate-pirls-questions'; 

const GeneratePirlsQuestionsFromTextInputSchema = z.object({
  text: z.string().describe("The text content to be used for generating questions."),
  questionMode: z.enum(['8-questions', '10-questions']).describe('選擇要生成的題組模式：8題或10題。'),
  languageMode: z.enum(['zh-TW', 'en']).describe('選擇題目與選項的語言：繁體中文或英文。'),
});
export type GeneratePirlsQuestionsFromTextInput = z.infer<typeof GeneratePirlsQuestionsFromTextInputSchema>;

// We can reuse the question schema from the other flow
const PirlsQuestionSchema = z.object({
  question: z.string().describe('問題的文字內容。'),
  options: z.array(z.string()).length(4).describe('四個答案選項，其中只有一個是正確的。'),
  correctAnswerIndex: z
    .number()
    .min(0)
    .max(3)
    .describe('正確答案在選項陣列中的索引（0-3）。'),
  explanation: z
    .string()
    .describe('解題引導與PIRLS層次說明。提示在文本中的具體段落、句子範圍或區域以尋找解題線索，並說明此問題如何符合其PIRLS層次的要求。此說明「絕對不可」揭露或暗示正確答案，也不可解釋選項。需使用台灣常用語彙的繁體中文。'),
  pirlsLevel: z
    .enum(['locate & retrieve', 'make straightforward inferences', 'interpret & integrate', 'evaluate & critique'])
    .describe('問題對應的PIRLS閱讀素養層次。'),
});

type PirlsQuestion = z.infer<typeof PirlsQuestionSchema>;

// Use a unified output schema
const GeneratePirlsQuestionsFromTextOutputSchema = z.object({
  title: z.string().describe('根據提供的文章內容，生成一個簡潔且最貼切的標題。'),
  articleContent: z.string().describe('回傳未經修改的原始文章內容。'),
  questions: z.array(PirlsQuestionSchema).describe('一個PIRLS風格的選擇題陣列。'),
});

export async function generatePirlsQuestionsFromText(
  input: GeneratePirlsQuestionsFromTextInput
): Promise<GeneratePirlsQuestionsOutput> {
  return generatePirlsQuestionsFromTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePirlsQuestionsFromTextPrompt',
  model: 'googleai/gemini-1.5-pro-latest',
  input: {schema: GeneratePirlsQuestionsFromTextInputSchema},
  output: {schema: GeneratePirlsQuestionsFromTextOutputSchema},
  prompt: `您是一位資深的課程設計師與評量專家，專長是為文章設計標題與 PIRLS 評量題目。

您的核心任務有兩個：
1.  **標題生成**：根據提供的「文本內容」，生成一個最能代表文章主旨的「標題」。
2.  **PIRLS 題目生成**：根據相同的「文本內容」，生成深刻且貼切的選擇題。**所有問題的答案都必須且只能從提供的文本內容中找到或推斷出來。**

**題目生成規則：**
{{#if is10QuestionMode}}
您必須根據以下分佈生成 **十個** 問題：訊息提取(3), 直接推論(3), 詮釋整合(2), 評估批判(2)。
{{else}}
您必須為每个PIRLS層次生成 **兩個** 問題，總共 **八個** 問題。
{{/if}}

**語言模式指令 (Language Mode Instruction):**
{{#if isEnglishMode}}
- **題目和選項語言**: 以**「英文」**撰寫 "question" 和 "options"。
- **解題引導語言**: "explanation" 欄位**「必須」**使用**「繁體中文（台灣常用語彙）」**撰寫。
{{else}}
- **所有欄位語言**: 全部使用**「繁體中文（台灣常用語彙）」**撰寫。
{{/if}}

**重要指令：**
1.  **返回原文**：在 \`articleContent\` 欄位中，您必須回傳**「完整且未經修改」**的原始文章內容。
2.  **選項設計**：就算是「評估與批判」類型的題目，也必須設計出一個最合理的、能從文本支持的答案作為唯一正確答案。
3.  **解題引導（explanation 欄位）**：
    -   以**繁體中文（台灣常用語彙）**撰寫。
    -   **「絕對不可」**透露正確答案。
    -   清晰地**引導使用者**在文本的「哪一個具體段落或區域」可以找到解題線索，並說明問題如何符合其 PIRLS 層次。

提供的文本內容如下：
---
{{{text}}}
---

請確保輸出的結果是一個有效的JSON物件，且其結構需符合指定的輸出結構描述，包含 \`title\`, \`articleContent\`, 和 \`questions\`。
  `,
});

const generatePirlsQuestionsFromTextFlow = ai.defineFlow(
  {
    name: 'generatePirlsQuestionsFromTextFlow',
    inputSchema: GeneratePirlsQuestionsFromTextInputSchema,
    outputSchema: GeneratePirlsQuestionsFromTextOutputSchema,
  },
  async (input) => {
    const {output} = await prompt({
      ...input,
      is10QuestionMode: input.questionMode === '10-questions',
      isEnglishMode: input.languageMode === 'en',
    });

    if (output && output.questions) {
      const pirlsLevelOrder: Record<PirlsQuestion['pirlsLevel'], number> = {
        'locate & retrieve': 1,
        'make straightforward inferences': 2,
        'interpret & integrate': 3,
        'evaluate & critique': 4,
      };

      output.questions.sort((a, b) => {
        return pirlsLevelOrder[a.pirlsLevel] - pirlsLevelOrder[b.pirlsLevel];
      });
    }
    
    // The flow now returns the full object shape.
    return output!;
  }
);
