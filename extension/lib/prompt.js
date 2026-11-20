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
  if (questionMode === '5-questions') {
    return { 'locate & retrieve': 2, 'make straightforward inferences': 1, 'interpret & integrate': 1, 'evaluate & critique': 1 };
  }
  return questionMode === '10-questions'
    ? { 'locate & retrieve': 3, 'make straightforward inferences': 3, 'interpret & integrate': 2, 'evaluate & critique': 2 }
    : { 'locate & retrieve': 2, 'make straightforward inferences': 2, 'interpret & integrate': 2, 'evaluate & critique': 2 };
}

function countBlock(questionMode) {
  if (questionMode === '5-questions') {
    return `**共 5 題**（快速版）：
- locate & retrieve（訊息提取）：**2 題**
- make straightforward inferences（直接推論）：**1 題**
- interpret & integrate（詮釋整合）：**1 題**
- evaluate & critique（評估批判）：**1 題**`;
  }
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
2. **題目必須引用文章內容**：每題的 \`question\` 與 \`explanation\` 都應該提到文章中真實出現的關鍵字（explanation 用這些關鍵字帶學生回文章，不可說出答案），老師才能驗證題目是基於真實圖片內容。
3. **PIRLS 層次必須嚴格平衡**：見下方分配。

# 📋 題數與層次

${countBlock(questionMode)}

# 🌐 語言模式

${languageBlock(languageMode)}

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

# 📐 其他規則

- 每題 4 個選項，僅一個正確答案
- 干擾選項要合理但明確錯誤
- \`explanation\` 依照上方「閱讀引導」的寫法，不可說出答案
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
2. **題目必須引用文章內容**：每一題的 \`question\` 與 \`explanation\` 都應該提到文章中真實出現的關鍵字（explanation 用這些關鍵字帶學生回文章，不可說出答案）、人物、事件，這樣老師才能驗證題目是基於真實文章。憑空捏造文中沒有的內容是嚴重錯誤。
3. **PIRLS 層次必須嚴格平衡**：見下方分配。

# 📋 題數與層次

${countBlock(questionMode)}

${gradeBlock(grade)}# 🌐 語言模式

${languageBlock(languageMode)}

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

請在心中確認以下檢查項，**有任何一項做不到就重新生成**：

- [ ] 我的 \`articleContent\` 是否與上方 <ARTICLE> 中的文字完全一致？
- [ ] 我的每一題是否引用了文章中真實出現的字詞？
- [ ] 我的 PIRLS 四層次題數是否完全符合上面的分配？
- [ ] 每題的 \`explanation\` 是否都是「閱讀引導」：有指出回到哪一段、提示找什麼或怎麼想，而且**完全沒有寫出正確答案或它的意思**？

# 📐 其他規則

- 每題 4 個選項，僅一個正確答案
- 干擾選項要合理但明確錯誤
- \`explanation\` 依照上方「閱讀引導」的寫法，不可說出答案
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

// ---- YouTube 影片出題（v0.9.0，只有擴充套件有；網站沒有對應的後端提示詞） ----
function videoGradeBlock(grade) {
  const g = gradeOf(grade);
  if (!g) return '';
  return `# 🎒 適讀年級：${g.label}

學生是${g.label}。影片重點摘要的寫法要符合下列標準：

${bullets(g.rewrite)}

題目的用字、句子長度與思考難度都要配合下列年級標準：

${bullets(g.questions)}

PIRLS 四層次的題數分配不變，只調整每一題的難度。

`;
}

/** 影片出題。影片（YouTube 網址）放在本訊息前面；rangeText 例：「02:00～08:30」或「完整影片」。 */
export function videoPrompt({ questionMode, languageMode, grade = '', title = '', rangeText = '完整影片' }) {
  return `# 📥 給你的影片（你唯一可以使用的內容來源）

（YouTube 影片已附在本訊息前面${title ? `，標題是「${title}」` : ''}；這次要看的範圍：${rangeText}）

---

你是 PIRLS 閱讀素養評量出題專家，現在要用「觀看理解」的方式出題：學生先看影片，再回答題目。

請根據**影片中真實出現的畫面、旁白、對話與字幕**完成下列任務。**禁止**使用影片以外的知識或內容。

# 🚨 三大鐵律

1. **articleContent 是「影片重點摘要」**：用 3～6 段文字，依影片順序整理重要內容（人物、事件、說明的重點、數字），讓沒看過影片的老師也能核對題目。每段開頭標出時間，例如「【01:20】」。**不可虛構影片中沒有的內容**。段落之間空一行。
2. **題目必須來自影片**：每一題的 \`question\` 與 \`explanation\` 都要對應影片中真實出現的內容，學生看完影片才答得出來。
3. **PIRLS 層次必須嚴格平衡**：見下方分配。

# 📋 題數與層次

${countBlock(questionMode)}

各層次在影片中的意思：
- locate & retrieve（訊息提取）：影片中明確說出或看得到的資訊
- make straightforward inferences（直接推論）：把影片中相鄰的兩、三個訊息連起來
- interpret & integrate（詮釋整合）：整合影片不同段落，理解主旨、人物想法或因果
- evaluate & critique（評估批判）：評估影片的說明方式、例子或觀點

${videoGradeBlock(grade)}# 🌐 語言模式

${languageBlock(languageMode)}

# ✍️ explanation 的寫法（閱讀引導：不可說出答案）

\`explanation\` 是給學生的「閱讀引導」：學生作答後會看到它，目的是帶學生回到影片，自己找到答案。**絕對不可以寫出正確答案**，每題都要包含三件事：

1. **回到哪裡**：寫出影片時間點（MM:SS，例如「回到影片 03:12 附近」）。
2. **找什麼、怎麼想**：提示要注意的旁白、畫面或關鍵詞，或給一個思考步驟（例如「注意題目問的是……，不是……」）。
3. **練習的能力**：最後用一句話說明這題練習的是哪一個 PIRLS 層次的能力。

🚫 不可以寫出正確選項的文字或它的意思、不可寫「答案是」、不可說哪個選項對或錯；上傳後選項順序會被打亂，也不可寫「選項一」「第二個」「A」這類代稱。

# 📝 自我檢查（生成前先做）

- [ ] articleContent 是不是依影片順序、標了時間的重點摘要，而且沒有編造？
- [ ] 每一題是不是都看完影片才答得出來？
- [ ] PIRLS 四層次題數是否完全符合上面的分配？
- [ ] 每題的 explanation 是否都有影片時間點，而且沒有說出答案？

# 📐 其他規則

- 每題 4 個選項，僅一個正確答案
- 干擾選項要合理但明確錯誤
- 「評估與批判」題仍要有單一最合理答案，不是開放題
- title：用影片的主題取一個 20 字以內的標題

請輸出符合 schema 的 JSON 物件。
`;
}
