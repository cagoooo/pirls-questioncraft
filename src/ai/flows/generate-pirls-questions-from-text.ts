// src/ai/flows/generate-pirls-questions-from-text.ts
'use server';

/**
 * @fileOverview Generates PIRLS-style multiple-choice questions based on text content.
 *
 * - generatePirlsQuestionsFromText - A function that generates PIRLS questions from text.
 * - GeneratePirlsQuestionsFromTextInput - The input type for the function.
 * - GeneratePirlsQuestionsOutput - The output type for the function (shared with image flow).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { GeneratePirlsQuestionsOutput } from './generate-pirls-questions';

// Re-export the shared output type
export type { GeneratePirlsQuestionsOutput } from './generate-pirls-questions';

const GeneratePirlsQuestionsFromTextInputSchema = z.object({
  text: z.string().describe("The text content to be used for generating questions."),
  questionMode: z.enum(['8-questions', '10-questions']).describe('選擇要生成的題組模式：8題或10題。'),
  languageMode: z.enum(['zh-TW', 'en']).describe('選擇題目與選項的語言：繁體中文或英文。'),
});
export type GeneratePirlsQuestionsFromTextInput = z.infer<typeof GeneratePirlsQuestionsFromTextInputSchema>;

// We can reuse the output schema from the other flow
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

const GeneratePirlsQuestionsOutputSchemaForText = z.object({
  questions: z.array(PirlsQuestionSchema).describe('一個PIRLS風格的選擇題陣列。'),
});

export async function generatePirlsQuestionsFromText(
  input: GeneratePirlsQuestionsFromTextInput
): Promise<GeneratePirlsQuestionsOutput> {
  return generatePirlsQuestionsFromTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePirlsQuestionsFromTextPrompt',
  model: 'googleai/gemini-1.0-pro',
  input: {schema: GeneratePirlsQuestionsFromTextInputSchema},
  output: {schema: GeneratePirlsQuestionsOutputSchemaForText},
  prompt: `您是一位資深的課程設計師與評量專家，專精於為 PIRLS（國際閱讀素養進展研究）閱讀理解評估設計高品質的題目。

您的核心任務是根據提供的「文本內容」，生成深刻且貼切的選擇題。**所有問題的答案都必須且只能從提供的文本內容中找到或推斷出來。**

{{#if is10QuestionMode}}
您必須根據以下分佈生成 **十個** 問題：
- **訊息提取與檢索 (Locate and Retrieve)**: 3 題
- **直接推論 (Make Straightforward Inferences)**: 3 題
- **詮釋與整合 (Interpret and Integrate)**: 2 題
- **評估與批判 (Evaluate and Critique)**: 2 題
總共十題。
{{else}}
您必須為每個PIRLS層次生成 **兩個** 問題，總共 **八個** 問題。
{{/if}}

**語言模式指令 (Language Mode Instruction):**
{{#if isEnglishMode}}
- **題目和選項語言 (Question and Options Language)**: 您必須以**「英文」**撰寫所有的 "question" 和 "options" 欄位。
- **解題引導語言 (Explanation Language)**: "explanation" 欄位**「必須」**使用**「繁體中文（台灣常用語彙）」**撰寫。
{{else}}
- **所有欄位語言 (All Fields Language)**: 所有欄位，包括 "question", "options", 和 "explanation"，都必須使用**「繁體中文（台灣常用語彙）」**撰寫。
{{/if}}

**重要指令：**
1.  **題幹品質**：問題設計需專業，緊密圍繞文本的核心資訊、細節、主題或觀點。
2.  **選項設計**：每個問題必須有四個答案選項，其中只有一個是正確的。
3.  **解題引導（explanation 欄位）**：
    -   請以**完全繁體中文（台灣常用語彙）**撰寫。
    -   **「絕對不可」**直接或間接透露正確答案，也不可解釋任何選項的對錯。
    -   唯一目的：清晰地**引導使用者**在文本的「哪一個具體段落、句子範圍或特定區域」可以找到解題線索。
    -   除了引導位置，也需簡要說明此問題的提問方式如何符合其對應的 PIRLS 層次要求。

每個問題還必須標明其PIRLS層次（pirlsLevel）。

提供的文本內容如下：
---
{{{text}}}
---

請確保輸出的結果是一個有效的JSON物件，且其結構需符合指定的輸出結構描述。
  `,
});

const generatePirlsQuestionsFromTextFlow = ai.defineFlow(
  {
    name: 'generatePirlsQuestionsFromTextFlow',
    inputSchema: GeneratePirlsQuestionsFromTextInputSchema,
    outputSchema: GeneratePirlsQuestionsOutputSchemaForText,
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
    
    return output!;
  }
);
