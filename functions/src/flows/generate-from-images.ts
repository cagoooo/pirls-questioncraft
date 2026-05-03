// 改寫自 src/ai/flows/generate-pirls-questions.ts，
// 邏輯與 prompt 完全相同，只是搬到 Cloud Functions 內、不再是 Next Server Action。
import { z } from 'genkit';
import { ai } from '../genkit';

const InputSchema = z.object({
  photoDataUris: z.array(z.string()),
  questionMode: z.enum(['8-questions', '10-questions']),
  languageMode: z.enum(['zh-TW', 'en']),
});

const PirlsQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswerIndex: z.number().min(0).max(3),
  explanation: z.string(),
  pirlsLevel: z.enum([
    'locate & retrieve',
    'make straightforward inferences',
    'interpret & integrate',
    'evaluate & critique',
  ]),
});

const OutputSchema = z.object({
  title: z.string(),
  articleContent: z.string(),
  questions: z.array(PirlsQuestionSchema),
});

export type GenerateFromImagesInput = z.infer<typeof InputSchema>;
export type GenerateFromImagesOutput = z.infer<typeof OutputSchema>;
type PirlsQuestion = z.infer<typeof PirlsQuestionSchema>;

const prompt = ai.definePrompt({
  name: 'generatePirlsQuestionsFromImagesPrompt',
  // B.15 升級：lite → flash，OCR 與指令遵守度顯著提升、仍在免費層內
  model: 'googleai/gemini-2.5-flash',
  input: { schema: InputSchema },
  output: { schema: OutputSchema },
  prompt: `# 📥 給你的圖片（你唯一可以使用的內容來源）

{{#each photoDataUris}}{{media url=this}}{{/each}}

---

你是 PIRLS 閱讀素養評量出題專家，同時擅長 OCR 與編輯。

請根據**上方圖片中真實出現的文字**完成下列任務。**禁止**使用任何圖片中沒有的內容。

# 🚨 三大鐵律

1. **articleContent**：仔細 OCR 所有圖片，校正錯字、連接斷句、合理分段，整理成通順的文章。**不可虛構任何圖片中沒有的人物、事件、數字**。
2. **題目必須引用文章內容**：每題的 \`question\` 與 \`explanation\` 都應該提到文章中真實出現的關鍵字，老師才能驗證題目是基於真實圖片內容。
3. **PIRLS 層次必須嚴格平衡**：見下方分配。

# 📋 題數與層次

{{#if is10QuestionMode}}
**共 10 題**：
- locate & retrieve（訊息提取）：**3 題**
- make straightforward inferences（直接推論）：**3 題**
- interpret & integrate（詮釋整合）：**2 題**
- evaluate & critique（評估批判）：**2 題**
{{else}}
**共 8 題**，每層恰好 2 題：
- locate & retrieve（訊息提取）：**2 題**
- make straightforward inferences（直接推論）：**2 題**
- interpret & integrate（詮釋整合）：**2 題**
- evaluate & critique（評估批判）：**2 題**
{{/if}}

# 🌐 語言模式

{{#if isEnglishMode}}
- \`question\` / \`options\`：**英文**
- \`explanation\`：**繁體中文（台灣常用語彙）**
{{else}}
- 所有文字欄位：**繁體中文（台灣常用語彙）**
{{/if}}

# 📝 自我檢查（生成前先做）

- [ ] \`articleContent\` 是否只包含圖片中真實出現的文字（含合理整理）？
- [ ] 我的每一題是否引用了 articleContent 中真實出現的字詞？
- [ ] PIRLS 四層次題數是否完全符合上面的分配？
- [ ] 每題的 \`explanation\` 是否「絕對沒有」洩漏正確答案？

# 📐 其他規則

- 每題 4 個選項，僅一個正確答案
- 干擾選項要合理但明確錯誤
- \`explanation\` 應引導讀者到「文章哪一段／哪一句」找線索 + 說明此題如何符合 PIRLS 層次
- 「評估與批判」題仍要有單一最合理答案

請輸出符合 schema 的 JSON 物件。
`,
});

export async function runGenerateFromImages(
  input: GenerateFromImagesInput
): Promise<GenerateFromImagesOutput> {
  const { output } = await prompt({
    ...input,
    is10QuestionMode: input.questionMode === '10-questions',
    isEnglishMode: input.languageMode === 'en',
  } as any);

  if (output && output.questions) {
    const order: Record<PirlsQuestion['pirlsLevel'], number> = {
      'locate & retrieve': 1,
      'make straightforward inferences': 2,
      'interpret & integrate': 3,
      'evaluate & critique': 4,
    };
    output.questions.sort((a, b) => order[a.pirlsLevel] - order[b.pirlsLevel]);
  }
  return output!;
}
