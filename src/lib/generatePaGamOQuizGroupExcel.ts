// src/lib/generatePaGamOQuizGroupExcel.ts
'use client';

import * as XLSX from 'xlsx';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import type { Toast } from '@/hooks/use-toast';

type ProgressCallback = (progress: number, message: string) => void;

export async function exportPIRLStoPaGamOQuizGroup(
  questionsOutput: GeneratePirlsQuestionsOutput,
  articleContent: string,
  articleTitle: string,
  showToast: typeof Toast,
  updateProgressCallback: ProgressCallback
) {
  try {
    updateProgressCallback(0, '開始準備 PaGamO 題組資料...');

    const optionLabels = ['A', 'B', 'C', 'D'];

    // --- Data Preparation ---
    const dataRows: (string | number | null)[][] = [];

    // Row for "Quiz Group Header" (題組題本) - The "Dragon Head" row
    const groupHeaderRow: (string | number | null)[] = new Array(25).fill(null);
    groupHeaderRow[0] = 1;                  // A: 編號
    groupHeaderRow[1] = '閱讀素養題組';   // B: 科目
    groupHeaderRow[2] = '資訊冊';         // C: 冊次
    groupHeaderRow[3] = '資訊章';         // D: 章節
    groupHeaderRow[5] = articleTitle;       // F: 標題(必填)
    groupHeaderRow[6] = articleContent;     // G: 內容(必填)
    dataRows.push(groupHeaderRow);

    // Subsequent Rows: The individual questions
    questionsOutput.questions.forEach((q, index) => {
      updateProgressCallback(10 + Math.round(((index + 1) / questionsOutput.questions.length) * 80), `處理題組題目 ${index + 1} / ${questionsOutput.questions.length}`);
      
      const row: (string | number | null)[] = new Array(25).fill(null);
      
      row[0] = `1_${index + 1}`;                     // A: 編號 (e.g., 1_1, 1_2)
      // B, C, D are intentionally left blank for question rows as they belong to the group
      row[8] = q.question;                            // I: 題目(必填)
      row[10] = q.options[0] || '';                   // K: 選項A
      row[12] = q.options[1] || '';                   // M: 選項B
      row[14] = q.options[2] || '';                   // O: 選項C
      row[16] = q.options[3] || '';                   // Q: 選項D
      row[20] = optionLabels[q.correctAnswerIndex];   // U: 正確答案
      row[21] = q.explanation;                        // V: 文字詳解
      
      dataRows.push(row);
    });

    updateProgressCallback(90, '正在建立 PaGamO Excel 工作表...');

    // --- Worksheet Creation with Headers and Merges ---
    const worksheet = XLSX.utils.aoa_to_sheet([]); // Create an empty sheet

    // Exact header content from the provided CSV
    const headerData = [
      ['範本版號', 'v1.0'],
      ['題組資訊', null, null, null, null, '題組共用內容', null, null, '題目內容', null, '選項', null, null, null, null, null, null, null, null, null, '答案和詳解', null, null, '設定'],
      ['編號(必填)', '科目(必填) ', '冊次(必填)', '章節(必填)', '難度', '標題(必填)', '內容(必填)', '內容多媒體檔名', '題目(必填)', '題目多媒體檔名', '選項A(必填)', '選項多媒體檔名', '選項B(必填)', '選項多媒體檔名', '選項C', '選項多媒體檔名', '選項D', '選項多媒體檔名', '選項E', '選項多媒體檔名', '正確答案(必填)', '文字詳解', '文字詳解多媒體檔名', '選項排列', '標籤（僅限課程題庫使用）'],
      ['說明'],
      ['1.題組編號照數字順序填寫\n\n2.題目編號為題組編號加上"_"並照數字順序填寫\n\n3.題目接在該題組的下方填寫', '1.若原題庫沒有對應的科目、冊次、章節，將自動建立。\n\n2.科目、冊次、章節名稱長度限30個中文字或字母（含空格），字與字中間最多可以放一個空格，其餘的空格在上傳時會被清除。\n\n3.章節內可以有子章節，以半型"/"分隔，最多可有2層子章節，例如：「平行與四邊形/平行/性質」。\n\n4.若章節A下有子章節，則章節A本身不可放題目，一定得放在子章節內。', null, null, '1.請填寫國字或數字，或直接使用下拉選單，國字與數字的對應：\n無：0\n易：1\n中：2\n難：3\n\n2.若未填寫，預設為無（0）', '輸入文字', '輸入文字。可使用語法“[顯示文字](連結網址)”來對特定文字加入超連結。例如：[點我前往](https://www.pagamo.org/)', '1.請寫上完整檔名(含副檔名)，檔名不可重複。\n\n2.僅接受JPG,PNG,MP3檔。\n\n3.若有兩個以上的多媒體檔案，請以半型"&"分隔。\n\n4.請將多媒體檔案與Excel檔在檔案上傳頁面一起選擇上傳，或一起放在同個壓縮檔。', '1.請填寫文字\n\n2.可使用語法“[顯示文字](連結網址)”來對特定文字加入超連結。如：[點我前往](https://www.pagamo.org/)', '1.請寫上完整檔名(含副檔名)，檔名不可重複。\n\n2.僅接受JPG,PNG,MP3檔。\n\n3.若有兩個以上的多媒體檔案，請以半型"&"分隔。\n\n4.請將多媒體檔案與Excel檔在檔案上傳頁面一起選擇上傳，或一起放在同個壓縮檔。', '選項：\n1.至少需填寫兩個選項，至多五項。\n\n2.請填寫文字\n\n3.可使用語法“[顯示文字](連結網址)”來對特定文字加入超連結。例如：[點我前往](https://www.pagamo.org/)\n\n選項多媒體檔名：\n1.請填寫完整檔名(含副檔名)，檔名不可重複。\n\n2.僅接受JPG,PNG,MP3檔。\n\n3.若有兩個以上的多媒體檔案，請以半型""&""分隔。\n\n4.請將多媒體檔案與 Excel 檔在檔案上傳頁面一起選擇上傳，或一起放在同個壓縮檔。', null, null, null, null, null, null, null, null, null, '若為複選題（有兩個答案以上），請以半型"&"分隔。', '1.請填寫文字\n\n2.可使用語法“[顯示文字](連結網址)”來對特定文字加入超連結。如：[點我前往](https://www.pagamo.org/)', '1.請寫上完整檔名(含副檔名)，檔名不可重複。\n\n2.僅接受JPG,PNG,MP3檔。\n\n3.若有兩個以上的多媒體檔案，請以半型"&"分隔。\n\n4.請將多媒體檔案與Excel檔在檔案上傳頁面一起選擇上傳，或一起放在同個壓縮檔。', '1.輸入"v"或"x"\n題目隨機排列：v\n關閉題目隨機排列“x\n\n2.若未填寫，預設為開啟題目隨機排列。', '1.只能填寫上傳時所選題庫的既有標籤。\n\n2.若有一題要設定多個標籤，請以半形"&"分隔。'],
      ['範例'],
      ['1', '國文', '雅量', '第一章', '1', '席慕容<鄉愁>', '故鄉的歌是一隻清遠的笛，\n總在有月亮的晚上想起。\n故鄉的面貌卻是一種模糊的惆悵，\n彷彿霧裡的揮手離別，\n離別後，\n鄉愁是一顆沒有年輪的樹，\n永不老去'],
      ['1_1', null, null, null, null, null, null, null, '這首詩大量運用何種修辭法造成豐富的意象，使讀者產生優美聯想。', 'Q1.jpg&Q2.jpg', '映襯', 'A1.jpg', '譬喻', 'A2.jpg', '感嘆', null, '誇飾', null, '擬人', null, 'B&E', null, null, 'v', '理解&修辭']
    ];

    XLSX.utils.sheet_add_aoa(worksheet, headerData, { origin: 'A1' });

    // Apply merges
    worksheet['!merges'] = [
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // A2:E2 '題組資訊'
        { s: { r: 1, c: 5 }, e: { r: 1, c: 7 } }, // F2:H2 '題組共用內容'
        { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } }, // I2:J2 '題目內容'
        { s: { r: 1, c: 10 }, e: { r: 1, c: 19 } },// K2:T2 '選項'
        { s: { r: 1, c: 20 }, e: { r: 1, c: 22 } },// U2:W2 '答案和詳解'
        { s: { r: 1, c: 23 }, e: { r: 1, c: 24 } },// X2:Y2 '設定'
    ];

    // Warning text
    worksheet['A9'] = { t: 's', v: '（請勿更動以上內容）第十一列開始為要上傳的內容，請參照範例填寫，最多可填寫 1,000 列' };
    
    // Detailed headers for row 10 (which is now empty, let's put it there for reference)
    // Actually, the CSV shows the header on row 3 and then the data starts. Let's stick to the CSV.
    // The previous request said to make row 3 and 10 identical, but the new CSV is the source of truth.
    // The new CSV only has this header on row 3.
    
    // Add the actual data starting from row 11 (origin: A11)
    XLSX.utils.sheet_add_aoa(worksheet, dataRows, { origin: 'A11' });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'reading_comprehension');

    updateProgressCallback(95, '準備下載 PaGamO 題組檔案...');
    XLSX.writeFile(workbook, 'PIRLS_PaGamO_題組.xlsx', { bookSST: true });
    
    updateProgressCallback(100, 'PaGamO 題組檔案已開始下載！');
    showToast({
      title: "成功下載 PaGamO 題組檔案",
      description: "PaGamO 題組 Excel 檔案已成功下載。",
      variant: "default",
      className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
    });

  } catch (error: any) {
    console.error("生成 PaGamO 題組檔案時發生錯誤:", error);
    updateProgressCallback(100, 'PaGamO 題組檔案生成失敗。');
    showToast({
      title: "PaGamO 題組生成失敗",
      description: `無法生成 PaGamO 題組檔案: ${error.message || '未知錯誤'}`,
      variant: "destructive",
    });
  }
}
    
