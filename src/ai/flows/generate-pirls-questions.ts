// src/ai/flows/generate-pirls-questions.ts
'use server';

/**
 * @fileOverview Generates PIRLS questions, article text, and a title from a set of images.
 * - generatePirlsQuestions - A function that performs OCR on images and generates questions.
 * - GeneratePirlsQuestionsInput - The input type for the function.
 * - GeneratePirlsQuestionsOutput - The output type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// This is the schema for the input that the UI will provide.
const GeneratePirlsQuestionsInputSchema = z.object({
  photoDataUris: z.array(z.string()).describe(
    "An array of photos of the text to be used, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
  ),
  questionMode: z.enum(['8-questions', '10-questions']).describe('選擇要生成的題組模式：8題或10題。'),
  languageMode: z.enum(['zh-TW', 'en']).describe('選擇題目與選項的語言：繁體中文或英文。'),
});
export type GeneratePirlsQuestionsInput = z.infer<typeof GeneratePirlsQuestionsInputSchema>;

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

const GeneratePirlsQuestionsOutputSchema = z.object({
  title: z.string().describe('根據提取出的文章內容，生成一個簡潔貼切的標題。'),
  articleContent: z.string().describe('從圖片中完整提取出的所有文字內容，並已重組成一篇通順、流暢、且已分段的文章。'),
  questions: z.array(PirlsQuestionSchema).describe('一個PIRLS風格的選擇題陣列。'),
});
export type GeneratePirlsQuestionsOutput = z.infer<typeof GeneratePirlsQuestionsOutputSchema>;


export async function generatePirlsQuestions(
  input: GeneratePirlsQuestionsInput
): Promise<GeneratePirlsQuestionsOutput> {
  return generatePirlsQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePirlsQuestionsFromImagesPrompt',
  model: 'googleai/gemini-1.5-pro-latest',
  input: {schema: GeneratePirlsQuestionsInputSchema},
  output: {schema: GeneratePirlsQuestionsOutputSchema},
  prompt: `您是一位資深的課程設計師、專業編輯與評量專家，專精於將圖片中的文字轉換為高品質的 PIRLS 閱讀評量。

您的核心任務有三個，請嚴格依序執行：

1.  **文字提取與文章重組**：
    *   仔細辨識**「所有」**提供的圖片，完整提取所有文字。
    *   根據上下文語意，校正錯字、連接斷句，並將文字重組成一篇**分段清晰、通順連貫的完整文章**。輸出的 \`articleContent\` 必須是高品質的成品。

2.  **標題生成**：
    *   根據您最終完成的文章內容，生成一個最能代表文章主旨的「標題」。

3.  **PIRLS 題目生成**：
    *   根據您重組的文章，生成深刻且貼切的選擇題。**所有問題的答案都必須且只能從文章內容中找到或推斷。**
    *   {{#if is10QuestionMode}}
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
- **選項設計**：就算是「評估與批判」類型的題目，也必須設計出一個最合理的、能從文本支持的答案作為唯一正確答案。
- **解題引導（explanation 欄位）**：
    -   以**繁體中文（台灣常用語彙）**撰寫。
    -   **「絕對不可」**透露正確答案。
    -   清晰地**引導使用者**在文本的「哪一個具體段落或區域」可以找到解題線索，並說明問題如何符合其 PIRLS 層次。

提供的圖片內容如下：
{{#each photoDataUris}}{{media url=this}}{{/each}}

請確保輸出的結果是一個有效的JSON物件，且其結構需符合指定的輸出結構描述，包含 \`title\`, \`articleContent\`, 和 \`questions\`。
  `,
});

const generatePirlsQuestionsFlow = ai.defineFlow(
  {
    name: 'generatePirlsQuestionsFromImagesFlow',
    inputSchema: GeneratePirlsQuestionsInputSchema,
    outputSchema: GeneratePirlsQuestionsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt({
      ...input,
      is10QuestionMode: input.questionMode === '10-questions',
      isEnglishMode: input.languageMode === 'en',
    });

    // Sort the questions by PIRLS level to ensure a consistent order from easy to hard.
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
