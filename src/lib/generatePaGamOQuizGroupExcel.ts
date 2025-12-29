// src/lib/generatePaGamOQuizGroupExcel.ts
'use client';

import * as XLSX from 'xlsx';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import type { Toast } from '@/hooks/use-toast';

type ProgressCallback = (progress: number, message: string) => void;

export interface PaGamOQuizGroupData {
  questionsOutput: GeneratePirlsQuestionsOutput;
  articleContent: string;
  articleTitle: string;
}

export function exportPIRLStoPaGamOQuizGroup(
  data: PaGamOQuizGroupData,
  showToast: typeof Toast,
  updateProgressCallback: ProgressCallback
) {
  try {
    const { questionsOutput, articleContent, articleTitle } = data;
    updateProgressCallback(80, '正在生成 PaGamO 題組 Excel...');

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

    const worksheet = XLSX.utils.aoa_to_sheet([]);

    const headerData = [
        ['範本版號', 'v1.0'],
        ['題組資訊', null, null, null, null, '題組共用內容', null, null, '題目內容', null, '選項', null, null, null, null, null, null, null, null, null, '答案和詳解', null, null, '設定'],
        ['編號(必填)', '科目(必填) ', '冊次(必填)', '章節(必填)', '難度', '標題(必填)', '內容(必填)', '內容多媒體檔名', '題目(必填)', '題目多媒體檔名', '選項A(必填)', '選項多媒體檔名', '選項B(必填)', '選項多媒體檔名', '選項C', '選項多媒體檔名', '選項D', '選項多媒體檔名', '選項E', '選項多媒體檔名', '正確答案(必填)', '文字詳解', '文字詳解多媒體檔名', '選項排列', '標籤（僅限課程題庫使用）'],
        ['說明'],
        [`1.題組編號照數字順序填寫

2.題目編號為題組編號加上"_"並照數字順序填寫

3.題目接在該題組的下方填寫`, `1.若原題庫沒有對應的科目、冊次、章節，將自動建立。

2.科目、冊次、章節名稱長度限30個中文字或字母（含空格），字與字中間最多可以放一個空格，其餘的空格在上傳時會被清除。

3.章節內可以有子章節，以半型"/"分隔，最多可有2層子章節，例如：「平行與四邊形/平行/性質」。

4.若章節A下有子章節，則章節A本身不可放題目，一定得放在子章節內。`, null, null, `1.請填寫國字或數字，或直接使用下拉選單，國字與數字的對應：
無：0
易：1
中：2
難：3

2.若未填寫，預設為無（0）`, '輸入文字', '輸入文字。可使用語法“[顯示文字](連結網址)”來對特定文字加入超連結。例如：[點我前往](https://www.pagamo.org/)', `1.請寫上完整檔名(含副檔名)，檔名不可重複。

2.僅接受JPG,PNG,MP3檔。

3.若有兩個以上的多媒體檔案，請以半型"&"分隔。

4.請將多媒體檔案與Excel檔在檔案上傳頁面一起選擇上傳，或一起放在同個壓縮檔。`, `1.請填寫文字

2.可使用語法“[顯示文字](連結網址)”來對特定文字加入超連結。如：[點我前往](https://www.pagamo.org/)`, `1.請寫上完整檔名(含副檔名)，檔名不可重複。

2.僅接受JPG,PNG,MP3檔。

3.若有兩個以上的多媒體檔案，請以半型"&"分隔。

4.請將多媒體檔案與Excel檔在檔案上傳頁面一起選擇上傳，或一起放在同個壓縮檔。`, `選項：
1.至少需填寫兩個選項，至多五項。

2.請填寫文字

3.可使用語法“[顯示文字](連結網址)”來對特定文字加入超連結。例如：[點我前往](https://www.pagamo.org/)

選項多媒體檔名：
1.請填寫完整檔名(含副檔名)，檔名不可重複。

2.僅接受JPG,PNG,MP3檔。

3.若有兩個以上的多媒體檔案，請以半型"&"分隔。

4.請將多媒體檔案與 Excel 檔在檔案上傳頁面一起選擇上傳，或一起放在同個壓縮檔。`, null, null, null, null, null, null, null, null, null, `若為複選題（有兩個答案以上），請以半型"&"分隔。`, `1.請填寫文字

2.可使用語法“[顯示文字](連結網址)”來對特定文字加入超連結。如：[點我前往](https://www.pagamo.org/)`, `1.請寫上完整檔名(含副檔名)，檔名不可重複。

2.僅接受JPG,PNG,MP3檔。

3.若有兩個以上的多媒體檔案，請以半型"&"分隔。

4.請將多媒體檔案與Excel檔在檔案上傳頁面一起選擇上傳，或一起放在同個壓縮檔。`, `1.輸入"v"或"x"
題目隨機排列：v
關閉題目隨機排列“x

2.若未填寫，預設為開啟題目隨機排列。`, `1.只能填寫上傳時所選題庫的既有標籤。

2.若有一題要設定多個標籤，請以半形"&"分隔。`],
        ['範例'],
        ['1', '國文', '雅量', '第一章', '1', '席慕容<鄉愁>', `故鄉的歌是一隻清遠的笛，
總在有月亮的晚上想起。
故鄉的面貌卻是一種模糊的惆悵，
彷彿霧裡的揮手離別，
離別後，
鄉愁是一顆沒有年輪的樹，
永不老去`],
        ['1_1', null, null, null, null, null, null, null, '這首詩大量運用何種修辭法造成豐富的意象，使讀者產生優美聯想。', 'Q1.jpg&Q2.jpg', '映襯', 'A1.jpg', '譬喻', 'A2.jpg', '感嘆', null, '誇飾', null, '擬人', null, 'B&E', null, null, 'v', '理解&修辭']
    ];

    XLSX.utils.sheet_add_aoa(worksheet, headerData, { origin: 'A1' });

    worksheet['A9'] = { t: 's', v: '（請勿更動以上內容）第十一列開始為要上傳的內容，請參照範例填寫，最多可填寫 1,000 列' };
    
    const row10Headers = ['編號(必填)', '科目(必填) ', '冊次(必填)', '章節(必填)', '難度', '標題(必填)', '內容(必填)', '內容多媒體檔名', '題目(必填)', '題目多媒體檔名', '選項A(必填)', '選項多媒體檔名', '選項B(必填)', '選項多媒體檔名', '選項C', '選項多媒體檔名', '選項D', '選項多媒體檔名', '選項E', '選項多媒體檔名', '正確答案(必填)', '文字詳解', '文字詳解多媒體檔名', '選項排列', '標籤（僅限課程題庫使用）'];
    XLSX.utils.sheet_add_aoa(worksheet, [row10Headers], { origin: 'A10' });

    worksheet['!merges'] = [
        // Row 2 merges
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },  // A2:E2
        { s: { r: 1, c: 5 }, e: { r: 1, c: 7 } },  // F2:H2
        { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } },  // I2:J2
        { s: { r: 1, c: 10 }, e: { r: 1, c: 19 } },// K2:T2
        { s: { r: 1, c: 20 }, e: { r: 1, c: 22 } },// U2:W2
        { s: { r: 1, c: 23 }, e: { r: 1, c: 24 } },// X2:Y2
        // Row 5 merges
        { s: { r: 4, c: 1 }, e: { r: 4, c: 3 } },  // B5:D5
        { s: { r: 4, c: 10 }, e: { r: 4, c: 19 } },// K5:T5
    ];

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
    
