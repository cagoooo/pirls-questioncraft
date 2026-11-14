// 依年級改寫文章：先把原文（或圖片中的文章）改寫成適合指定年級閱讀的版本，
// 再交給 generate-from-text 依同一個年級出題。
// ⚠️ 修改這裡的提示詞時，記得同步改擴充套件的 extension/lib/prompt.js（npm test 會檢查）。
import { z } from 'genkit';
import { ai } from '../genkit';
import GRADE_LEVELS from './grade-levels.json';

export const GRADE_IDS = ['1', '2', '3', '4', '5', '6'] as const;
export type GradeId = (typeof GRADE_IDS)[number];

export function isGradeId(v: unknown): v is GradeId {
  return typeof v === 'string' && (GRADE_IDS as readonly string[]).includes(v);
}

export function gradeInfo(id: GradeId) {
  const g = GRADE_LEVELS.find((x) => x.id === id)!;
  return {
    gradeLabel: g.label,
    gradeRewriteGuide: g.rewrite.map((l) => `- ${l}`).join('\n'),
    gradeQuestionGuide: g.questions.map((l) => `- ${l}`).join('\n'),
  };
}

const RewriteOutputSchema = z.object({
  title: z.string(),
  articleContent: z.string(),
});
export type RewriteOutput = z.infer<typeof RewriteOutputSchema>;

const TextInputSchema = z.object({ text: z.string() });
const ImagesInputSchema = z.object({ photoDataUris: z.array(z.string()) });

const textRewritePrompt = ai.definePrompt({
  name: 'rewriteTextForGradePrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: TextInputSchema },
  output: { schema: RewriteOutputSchema },
  prompt: `# 📥 原始文章

<ARTICLE>
{{{text}}}
</ARTICLE>

---

你是國小國語文老師，擅長把文章改寫成適合不同年級學生閱讀的版本。

請把上方 <ARTICLE> 標籤之間的文章，改寫成適合「{{gradeLabel}}」學生閱讀的版本。

# 🎯 {{gradeLabel}}的改寫標準

{{{gradeRewriteGuide}}}

# 🚨 改寫鐵律

1. **只能改寫，不能編造**：保留原文的主題、主要人物、事件順序與重要事實；不可加入原文沒有的事實、人物、數字或結論。
2. **長度跟著原文**：原文比建議字數短時，維持原本長度，不要為了湊字數增加內容；原文太長時，保留主線，刪去枝節。
3. **格式**：段落之間空一行；不要加標題符號、項目符號、括號註解或改寫說明。
4. **語言**：原文是中文就用繁體中文（台灣常用語彙）改寫；原文是英文就用英文改寫，字彙與句型配合年級降低難度。
5. **title**：沿用原文的標題；原文沒有標題時，取一個 15 字以內的標題。

請輸出符合 schema 的 JSON 物件：title 是標題，articleContent 是改寫後的全文。
`,
});

const imagesRewritePrompt = ai.definePrompt({
  name: 'rewriteImagesForGradePrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: ImagesInputSchema },
  output: { schema: RewriteOutputSchema },
  prompt: `# 📥 原始文章圖片

{{#each photoDataUris}}{{media url=this}}{{/each}}

---

你是國小國語文老師，擅長把文章改寫成適合不同年級學生閱讀的版本。

請先仔細辨識上方圖片中的文章文字（略過頁首、頁尾、頁碼和廣告），再把這篇文章改寫成適合「{{gradeLabel}}」學生閱讀的版本。

# 🎯 {{gradeLabel}}的改寫標準

{{{gradeRewriteGuide}}}

# 🚨 改寫鐵律

1. **只能改寫，不能編造**：保留原文的主題、主要人物、事件順序與重要事實；不可加入原文沒有的事實、人物、數字或結論。
2. **長度跟著原文**：原文比建議字數短時，維持原本長度，不要為了湊字數增加內容；原文太長時，保留主線，刪去枝節。
3. **格式**：段落之間空一行；不要加標題符號、項目符號、括號註解或改寫說明。
4. **語言**：原文是中文就用繁體中文（台灣常用語彙）改寫；原文是英文就用英文改寫，字彙與句型配合年級降低難度。
5. **title**：沿用原文的標題；原文沒有標題時，取一個 15 字以內的標題。

請輸出符合 schema 的 JSON 物件：title 是標題，articleContent 是改寫後的全文。
`,
});

export async function runRewriteForGrade(
  input: { text: string; grade: GradeId } | { photoDataUris: string[]; grade: GradeId }
): Promise<RewriteOutput> {
  const info = gradeInfo(input.grade);
  const { output } =
    'text' in input
      ? await textRewritePrompt({ text: input.text, ...info } as any)
      : await imagesRewritePrompt({ photoDataUris: input.photoDataUris, ...info } as any);
  if (!output || !output.articleContent?.trim()) {
    throw new Error('AI 沒有成功改寫文章，請再試一次。');
  }
  return { title: output.title?.trim() || '', articleContent: output.articleContent.trim() };
}
