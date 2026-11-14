// 出題提示詞：移植自網站後端 functions/src/flows/generate-from-images.ts 與 generate-from-text.ts。
// ⚠️ 修改網站後端的提示詞時，記得同步改這裡（兩邊內容要一致）。
// 依年級改寫的提示詞移植自 functions/src/flows/rewrite-for-grade.ts。
import { GRADE_LEVELS } from './gradeLevels.js';

export { GRADE_LEVELS };

export function gradeOf(id) {
  return GRADE_LEVELS.find((g) => g.id === id) ?? null;
}

const bullets = (lines) => lines.map((l) => `- ${l}`).join('\n');

function gradeBlock(grade) {
  const g = gradeOf(grade);
  if (!g) return '';
  return `# 🎒 適讀年級：${g.label}

這篇文章已經改寫成適合${g.label}學生閱讀的版本。題目的用字、句子長度與思考難度都要配合下列年級標準：

${bullets(g.questions)}

PIRLS 四層次的題數分配不變，只調整每一題的難度。

`;
}

export const PIRLS_LEVELS = [
  'locate & retrieve',
  'make straightforward inferences',
  'interpret & integrate',
  'evaluate & critique',
];

export const LEVEL_LABEL = {
  'locate & retrieve': '訊息提取',
  'make straightforward inferences': '直接推論',
  'interpret & integrate': '詮釋整合',
  'evaluate & critique': '評估批判',
};

export function expectedDistribution(questionMode) {
  return questionMode === '10-questions'
    ? { 'locate & retrieve': 3, 'make straightforward inferences': 3, 'interpret & integrate': 2, 'evaluate & critique': 2 }
    : { 'locate & retrieve': 2, 'make straightforward inferences': 2, 'interpret & integrate': 2, 'evaluate & critique': 2 };
}

function countBlock(questionMode) {
  return questionMode === '10-questions'
    ? `**共 10 題**：
- locate & retrieve（訊息提取）：**3 題**
- make straightforward inferences（直接推論）：**3 題**
- interpret & integrate（詮釋整合）：**2 題**
- evaluate & critique（評估批判）：**2 題**`
    : `**共 8 題**，每層恰好 2 題：
- locate & retrieve（訊息提取）：**2 題**
- make straightforward inferences（直接推論）：**2 題**
- interpret & integrate（詮釋整合）：**2 題**
- evaluate & critique（評估批判）：**2 題**`;
}

function languageBlock(languageMode) {
  return languageMode === 'en'
    ? `- \`question\` / \`options\`：**英文**
- \`explanation\`：**繁體中文（台灣常用語彙）**`
    : `- 所有文字欄位：**繁體中文（台灣常用語彙）**`;
}

export function imagePrompt({ questionMode, languageMode }) {
  return `# 📥 給你的圖片（你唯一可以使用的內容來源）

（圖片已附在本訊息前面）

---

你是 PIRLS 閱讀素養評量出題專家，同時擅長 OCR 與編輯。

請根據**上方圖片中真實出現的文字**完成下列任務。**禁止**使用任何圖片中沒有的內容。

# 🚨 三大鐵律

1. **articleContent**：仔細 OCR 所有圖片，校正錯字、連接斷句、合理分段，整理成通順的文章。**不可虛構任何圖片中沒有的人物、事件、數字**。
2. **題目必須引用文章內容**：每題的 \`question\` 與 \`explanation\` 都應該提到文章中真實出現的關鍵字，老師才能驗證題目是基於真實圖片內容。
3. **PIRLS 層次必須嚴格平衡**：見下方分配。

# 📋 題數與層次

${countBlock(questionMode)}

# 🌐 語言模式

${languageBlock(languageMode)}

# ✍️ explanation 的寫法（答後講解）

\`explanation\` 只會在學生**作答之後**和正確答案一起顯示，是給學生的「答後講解」，不是作答前的提示。
所以可以、也應該直接說明答案，每題都要包含三件事：

1. **線索在哪裡**：指出文章第幾段或哪一句，並引用關鍵原文。
2. **為什麼正確答案對**：用原文說明正確選項的理由。
3. **其他選項為什麼不對**：簡短點出干擾選項錯在哪裡（例如文中沒提到、和原文相反、只說對一半）。

最後用一句話說明這題練習的是哪一個 PIRLS 層次的能力。

✅ 好的範例（只示範格式，內容來自另一篇文章，請勿抄用）：
「線索在第 3 段：『小華把斷掉的線重新綁好，再試了一次』。題目問小華風箏線斷了以後怎麼做，所以答案是重新綁好再試。放棄回家、請爸爸買新風箏在文中都沒有發生；生氣地把風箏丟掉和原文相反。這題練習『訊息提取』：在文中找出明確寫出的資訊。」

❌ 不好的範例：
「請回到第 2 段仔細閱讀。」（只指段落，沒有講解答案，學生答錯也看不懂原因）
「答案是 B。」（沒有引用原文，也沒說明其他選項為什麼錯）

# 📝 自我檢查（生成前先做）

- [ ] \`articleContent\` 是否只包含圖片中真實出現的文字（含合理整理）？
- [ ] 我的每一題是否引用了 articleContent 中真實出現的字詞？
- [ ] PIRLS 四層次題數是否完全符合上面的分配？
- [ ] 每題的 \`explanation\` 是否都是「答後講解」：有指出線索段落、說明正確答案的理由、點出其他選項錯在哪？

# 📐 其他規則

- 每題 4 個選項，僅一個正確答案
- 干擾選項要合理但明確錯誤
- \`explanation\` 依照上方「答後講解」的寫法
- 「評估與批判」題仍要有單一最合理答案

請輸出符合 schema 的 JSON 物件。
`;
}

export function textPrompt({ text, questionMode, languageMode, grade = '' }) {
  return `# 📥 給你的文章（這是你唯一可以使用的內容來源）

<ARTICLE>
${text}
</ARTICLE>

---

你是 PIRLS 閱讀素養評量出題專家。

請根據**上方 <ARTICLE> 標籤之間的這篇文章**設計題目。**禁止**使用任何文章以外的內容。

# 🚨 三大鐵律

1. **articleContent 欄位**：把上方 <ARTICLE> 中**完全相同的原文**逐字複製出來，不可修改任何一個字。
2. **題目必須引用文章內容**：每一題的 \`question\` 與 \`explanation\` 都應該提到文章中真實出現的關鍵字、人物、事件，這樣老師才能驗證題目是基於真實文章。憑空捏造文中沒有的內容是嚴重錯誤。
3. **PIRLS 層次必須嚴格平衡**：見下方分配。

# 📋 題數與層次

${countBlock(questionMode)}

${gradeBlock(grade)}# 🌐 語言模式

${languageBlock(languageMode)}

# ✍️ explanation 的寫法（答後講解）

\`explanation\` 只會在學生**作答之後**和正確答案一起顯示，是給學生的「答後講解」，不是作答前的提示。
所以可以、也應該直接說明答案，每題都要包含三件事：

1. **線索在哪裡**：指出文章第幾段或哪一句，並引用關鍵原文。
2. **為什麼正確答案對**：用原文說明正確選項的理由。
3. **其他選項為什麼不對**：簡短點出干擾選項錯在哪裡（例如文中沒提到、和原文相反、只說對一半）。

最後用一句話說明這題練習的是哪一個 PIRLS 層次的能力。

✅ 好的範例（只示範格式，內容來自另一篇文章，請勿抄用）：
「線索在第 3 段：『小華把斷掉的線重新綁好，再試了一次』。題目問小華風箏線斷了以後怎麼做，所以答案是重新綁好再試。放棄回家、請爸爸買新風箏在文中都沒有發生；生氣地把風箏丟掉和原文相反。這題練習『訊息提取』：在文中找出明確寫出的資訊。」

❌ 不好的範例：
「請回到第 2 段仔細閱讀。」（只指段落，沒有講解答案，學生答錯也看不懂原因）
「答案是 B。」（沒有引用原文，也沒說明其他選項為什麼錯）

# 📝 自我檢查（生成前先做）

請在心中確認以下檢查項，**有任何一項做不到就重新生成**：

- [ ] 我的 \`articleContent\` 是否與上方 <ARTICLE> 中的文字完全一致？
- [ ] 我的每一題是否引用了文章中真實出現的字詞？
- [ ] 我的 PIRLS 四層次題數是否完全符合上面的分配？
- [ ] 每題的 \`explanation\` 是否都是「答後講解」：有指出線索段落、說明正確答案的理由、點出其他選項錯在哪？

# 📐 其他規則

- 每題 4 個選項，僅一個正確答案
- 干擾選項要合理但明確錯誤
- \`explanation\` 依照上方「答後講解」的寫法
- 「評估與批判」題仍要有單一最合理答案，不是開放題

請輸出符合 schema 的 JSON 物件。
`;
}

// Gemini 結構化輸出格式（對應後端的 OutputSchema）
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    articleContent: { type: 'STRING' },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 4, maxItems: 4 },
          correctAnswerIndex: { type: 'INTEGER' },
          explanation: { type: 'STRING' },
          pirlsLevel: { type: 'STRING', enum: PIRLS_LEVELS },
        },
        required: ['question', 'options', 'correctAnswerIndex', 'explanation', 'pirlsLevel'],
        propertyOrdering: ['question', 'options', 'correctAnswerIndex', 'explanation', 'pirlsLevel'],
      },
    },
  },
  required: ['title', 'articleContent', 'questions'],
  propertyOrdering: ['title', 'articleContent', 'questions'],
};

// ---- 依年級改寫（對應 functions/src/flows/rewrite-for-grade.ts） ----
const REWRITE_RULES = `# 🚨 改寫鐵律

1. **只能改寫，不能編造**：保留原文的主題、主要人物、事件順序與重要事實；不可加入原文沒有的事實、人物、數字或結論。
2. **長度跟著原文**：原文比建議字數短時，維持原本長度，不要為了湊字數增加內容；原文太長時，保留主線，刪去枝節。
3. **一定要分段**：依內容分成數段，每段 2～4 句；articleContent 裡段落之間要放一個空白行（兩個換行字元）。不要加標題符號、項目符號、括號註解或改寫說明。
4. **語言**：原文是中文就用繁體中文（台灣常用語彙）改寫；原文是英文就用英文改寫，字彙與句型配合年級降低難度。
5. **title**：沿用原文的標題；原文沒有標題時，取一個 15 字以內的標題。

請輸出符合 schema 的 JSON 物件：title 是標題，articleContent 是改寫後的全文。
`;

/** 依年級改寫。text 有值＝改寫文字；沒有＝改寫圖片中的文章（圖片放在本訊息前面）。 */
export function rewritePrompt({ text = '', grade }) {
  const g = gradeOf(grade);
  if (!g) throw new Error(`不認得的年級：${grade}`);
  const head = text
    ? `# 📥 原始文章

<ARTICLE>
${text}
</ARTICLE>

---

你是國小國語文老師，擅長把文章改寫成適合不同年級學生閱讀的版本。

請把上方 <ARTICLE> 標籤之間的文章，改寫成適合「${g.label}」學生閱讀的版本。`
    : `# 📥 原始文章圖片

（圖片已附在本訊息前面）

---

你是國小國語文老師，擅長把文章改寫成適合不同年級學生閱讀的版本。

請先仔細辨識上方圖片中的文章文字（略過頁首、頁尾、頁碼和廣告），再把這篇文章改寫成適合「${g.label}」學生閱讀的版本。`;
  return `${head}

# 🎯 ${g.label}的改寫標準

${bullets(g.rewrite)}

${REWRITE_RULES}`;
}

/**
 * AI 偶爾會把全文擠成一整段。沒有任何換行時，依句尾每 3 句分一段。
 * ⚠️ 與網站後端 functions/src/flows/rewrite-for-grade.ts 的 ensureParagraphs 邏輯相同。
 */
export function ensureParagraphs(text) {
  const t = String(text ?? '').trim().replace(/\r\n/g, '\n');
  if (t.includes('\n') || t.length < 120) return t;
  const sentences = t.match(/[^。！？!?]+[。！？!?]+[」』"]?|[^。！？!?]+$/g) ?? [t];
  const paras = [];
  for (let i = 0; i < sentences.length; i += 3) paras.push(sentences.slice(i, i + 3).join('').trim());
  return paras.filter(Boolean).join('\n\n');
}

export const REWRITE_SCHEMA = {
  type: 'OBJECT',
  properties: { title: { type: 'STRING' }, articleContent: { type: 'STRING' } },
  required: ['title', 'articleContent'],
  propertyOrdering: ['title', 'articleContent'],
};
