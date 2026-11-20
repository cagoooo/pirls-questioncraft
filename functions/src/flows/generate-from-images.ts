// 改寫自 src/ai/flows/generate-pirls-questions.ts，
// 邏輯與 prompt 完全相同，只是搬到 Cloud Functions 內、不再是 Next Server Action。
import type { TokenUsage } from '../quota-pool';
import { z } from 'genkit';
import { ai } from '../genkit';

const InputSchema = z.object({
  photoDataUris: z.array(z.string()),
  questionMode: z.enum(['5-questions', '8-questions', '10-questions']),
  languageMode: z.enum(['zh-TW', 'en']),
});

const PirlsQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  // 答案依據：只給老師看（工作台、老師畫面、教師講義），學生端與匯出檔都不放；放在正解前面，讓 AI 先找依據再選答案
  answerEvidence: z.string(),
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
  model: 'googleai/gemini-3.5-flash-lite',
  // 2026-11-15 省錢：關閉思考（思考字詞按輸出價計費），出題品質由提示詞與結構化輸出把關
  config: { thinkingConfig: { thinkingLevel: 'MINIMAL' } },
  input: { schema: InputSchema },
  output: { schema: OutputSchema },
  prompt: `# 📥 給你的圖片（你唯一可以使用的內容來源）

{{#each photoDataUris}}{{media url=this}}{{/each}}

---

你是 PIRLS 閱讀素養評量出題專家，同時擅長 OCR 與編輯。

請根據**上方圖片中真實出現的文字**完成下列任務。**禁止**使用任何圖片中沒有的內容。

# 🚨 三大鐵律

1. **articleContent**：仔細 OCR 所有圖片，校正錯字、連接斷句、合理分段，整理成通順的文章。**不可虛構任何圖片中沒有的人物、事件、數字**。
2. **題目必須引用文章內容**：每題的 \`question\` 與 \`explanation\` 都應該提到文章中真實出現的關鍵字（explanation 用這些關鍵字帶學生回文章，不可說出答案），老師才能驗證題目是基於真實圖片內容。
3. **PIRLS 層次必須嚴格平衡**：見下方分配。

# 📋 題數與層次

{{#if is5QuestionMode}}
**共 5 題**（快速版）：
- locate & retrieve（訊息提取）：**2 題**
- make straightforward inferences（直接推論）：**1 題**
- interpret & integrate（詮釋整合）：**1 題**
- evaluate & critique（評估批判）：**1 題**
{{else}}
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
{{/if}}

# 🌐 語言模式

{{#if isEnglishMode}}
- \`question\` / \`options\`：**英文**
- \`explanation\`：**繁體中文（台灣常用語彙）**
- \`answerEvidence\`：**繁體中文**說明，引用原文時保留原文的語言
{{else}}
- 所有文字欄位：**繁體中文（台灣常用語彙）**
{{/if}}

# 🔍 answerEvidence 的寫法（答案依據：只給老師看）

\`answerEvidence\` **只給老師檢查題目用，學生完全看不到、也不會匯出**，所以這裡要清楚寫出答案的依據。
請**先寫好 \`answerEvidence\`，再決定 \`correctAnswerIndex\`**：
- 引用文章中支持正確答案的原文：寫出第幾段，原句用「」標出，一到兩句即可。
- 推論、詮釋、評估題：引用相關原句後，再用一句話說明怎麼從原文推到正確答案。
- 寫完再確認：\`correctAnswerIndex\` 指向的選項，和這段依據說的是同一件事。
- 這裡可以寫出答案；但 \`explanation\`（閱讀引導）仍然不可以。

# ✍️ explanation 的寫法（閱讀引導：不可說出答案）

\`explanation\` 是給學生的「閱讀引導」：學生作答後會看到它，**目的是帶學生回到文章，自己找到答案**，這樣才能真正提升閱讀理解能力。
所以**絕對不可以寫出正確答案**，每題都要包含三件事：

1. **回到哪裡**：指出要回到文章第幾段（或開頭、結尾、哪幾段之間）。
2. **找什麼、怎麼想**：提示要找的關鍵詞（用題目裡出現的人物、事件、詞語），或給一個思考步驟（例如「先找出……，再想想……」「注意題目問的是……，不是……」）。
3. **練習的能力**：最後用一句話說明這題練習的是哪一個 PIRLS 層次的能力。

🚫 不可以：
- 寫出正確選項的文字，或換句話說出它的意思
- 寫「答案是」「正確答案」「所以選」，或說哪個選項對、哪個選項錯
- 引用「直接寫著答案」的那一句原文
- 用 A、B、C、D 或「第幾個選項」指稱選項

✅ 好的範例（只示範格式，內容來自另一篇文章，請勿抄用）：
「回到第 3 段，看看小華發現風箏線斷了以後，『接下來』自己做了什麼。注意題目問的是小華自己怎麼做，不是別人幫他做什麼。這題練習『訊息提取』：在文中找出明確寫出的資訊。」
「把第 1 段和最後一段放在一起讀：小華一開始和最後的心情有什麼不同？想想中間發生了哪件事讓他改變。這題練習『詮釋整合』：統整全文，理解人物的感受。」

❌ 不好的範例：
「線索在第 3 段：『小華把斷掉的線重新綁好，再試了一次』，所以答案是重新綁好再試。」（直接說出答案，學生不用再讀文章）
「請回到文章仔細閱讀。」（沒指出段落，也沒有思考方向）

# 📝 自我檢查（生成前先做）

- [ ] \`articleContent\` 是否只包含圖片中真實出現的文字（含合理整理）？
- [ ] 我的每一題是否引用了 articleContent 中真實出現的字詞？
- [ ] PIRLS 四層次題數是否完全符合上面的分配？
- [ ] 每題的 \`explanation\` 是否都是「閱讀引導」：有指出回到哪一段、提示找什麼或怎麼想，而且**完全沒有寫出正確答案或它的意思**？
- [ ] 每題的 \`answerEvidence\` 是否引用了原文，而且和 \`correctAnswerIndex\` 指向的選項說的是同一件事？

# 📐 其他規則

- 每題 4 個選項，僅一個正確答案
- 干擾選項要合理但明確錯誤
- \`explanation\` 依照上方「閱讀引導」的寫法，不可說出答案
- \`answerEvidence\` 依照上方「答案依據」的寫法（只給老師看）
- 「評估與批判」題仍要有單一最合理答案

請輸出符合 schema 的 JSON 物件。
`,
});

export async function runGenerateFromImages(
  input: GenerateFromImagesInput,
  /** v0.4.0：回報這次 AI 用了多少 token（記到每月共用額度池） */
  onUsage?: (u: TokenUsage) => void
): Promise<GenerateFromImagesOutput> {
  const response = await prompt({
    ...input,
    is5QuestionMode: input.questionMode === '5-questions',
    is10QuestionMode: input.questionMode === '10-questions',
    isEnglishMode: input.languageMode === 'en',
  } as any);
  onUsage?.(response.usage ?? {});
  const output = response.output;

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
