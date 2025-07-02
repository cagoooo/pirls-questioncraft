// src/ai/flows/generate-pirls-questions.ts
'use server';

/**
 * @fileOverview Generates PIRLS-style multiple-choice questions based on text extracted from images.
 *
 * - generatePirlsQuestions - A function that generates PIRLS questions.
 * - GeneratePirlsQuestionsInput - The input type for the generatePirlsQuestions function.
 * - GeneratePirlsQuestionsOutput - The output type for the generatePirlsQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// This is the schema for the input that the UI will provide.
const GeneratePirlsQuestionsInputSchema = z.object({
  photoDataUris: z.array(z.string()).describe(
    "An array of photos of the text to be used, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
  ),
  questionMode: z.enum(['8-questions', '10-questions']).describe('選擇要生成的題組模式：8題或10題。'),
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

const GeneratePirlsQuestionsOutputSchema = z.object({
  questions: z.array(PirlsQuestionSchema).describe('一個PIRLS風格的選擇題陣列。'),
});
export type GeneratePirlsQuestionsOutput = z.infer<typeof GeneratePirlsQuestionsOutputSchema>;

export async function generatePirlsQuestions(
  input: GeneratePirlsQuestionsInput
): Promise<GeneratePirlsQuestionsOutput> {
  return generatePirlsQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePirlsQuestionsPrompt',
  input: {schema: GeneratePirlsQuestionsInputSchema},
  output: {schema: GeneratePirlsQuestionsOutputSchema},
  prompt: `您是一位專門為PIRLS（國際閱讀素養進展研究）閱讀理解評估設計題目的專家。

您的任務是根據提供的圖片內容生成選擇題。每個問題都應符合PIRLS四個閱讀素養層次之一：

1.  訊息提取與檢索（Locate and Retrieve）：這類問題要求學生在文本中找到明確陳述的資訊。
2.  直接推論（Make Straightforward Inferences）：這類問題要求學生根據文本中呈現的資訊做出簡單的結論。
3.  詮釋與整合（Interpret and Integrate）：這類問題要求學生結合文本不同部分的資訊來理解作者的含義或目的。
4.  評估與批判（Evaluate and Critique）：這類問題挑戰學生評估文本的品質和可信度。

{{#if is10QuestionMode}}
您必須根據以下分佈生成 **十個** 問題：
- **訊息提取與檢索**: 3 題
- **直接推論**: 3 題
- **詮釋與整合**: 2 題
- **評估與批判**: 2 題
總共十題。
{{else}}
您必須為每個PIRLS層次生成 **兩個** 問題，總共 **八個** 問題。
{{/if}}

每個問題必須有四個答案選項，其中只有一個是正確答案。請提供正確答案的索引（0-3）。

針對「說明」(explanation) 欄位：請以**完全繁體中文**提供解題引導。**此引導「絕對不可」直接或間接暗示哪個選項是正確答案，也不可解釋為何某選項正確或錯誤。** 其「唯一目的」是提示使用者在提供的文本中「哪一個具體段落、句子範圍或特定區域」可以找到與題目相關的資訊或思考線索，從而幫助他們自行推敲答案。說明文字必須使用台灣讀者習慣的自然語氣與詞彙。請指出在文章中的段落位置或如何得出，並說明這個問題如何符合 PIRLS層次的要求。

每個問題還必須標明其PIRLS層次（pirlsLevel）。

提供的圖片內容如下：
{{#each photoDataUris}}{{media url=this}}{{/each}}

請確保輸出的結果是一個有效的JSON物件，且其結構需符合指定的輸出結構描述。
  `,
});

const generatePirlsQuestionsFlow = ai.defineFlow(
  {
    name: 'generatePirlsQuestionsFlow',
    inputSchema: GeneratePirlsQuestionsInputSchema,
    outputSchema: GeneratePirlsQuestionsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt({
      ...input,
      is10QuestionMode: input.questionMode === '10-questions'
    });
    return output!;
  }
);
