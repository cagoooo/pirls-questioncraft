// 出題提示詞：移植自網站後端 functions/src/flows/generate-from-images.ts 與 generate-from-text.ts。
// ⚠️ 修改網站後端的提示詞時，記得同步改這裡（兩邊內容要一致）。

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

export function textPrompt({ text, questionMode, languageMode }) {
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
