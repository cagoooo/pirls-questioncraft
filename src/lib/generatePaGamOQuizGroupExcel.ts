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

    // Manually add headers and apply merges
    XLSX.utils.sheet_add_aoa(worksheet, [['版本資訊', 'v1.0']], { origin: 'A1' });
    
    // Row 2: Merged Headers
    worksheet['A2'] = { t: 's', v: '題組資訊' };
    worksheet['F2'] = { t: 's', v: '題組共用內容' };
    worksheet['I2'] = { t: 's', v: '題目內容' };
    worksheet['K2'] = { t: 's', v: '選項' };
    worksheet['U2'] = { t: 's', v: '答案和詳解' };
    worksheet['X2'] = { t: 's', v: '設定' };

    // Row 9: Warning text (in A9 only, no merge)
    worksheet['A9'] = { t: 's', v: '（請勿更動以上內容）第十一列開始為要上傳的內容，請參照範例填寫，最多可填寫 1,000 列' };

    // Row 10: Detailed column headers
    const row10Headers = [
        '編號(必填)', '科目(必填)', '冊次(必填)', '章節(必填)', '難度',
        '標題(必填)', '內容(必填)', '內容多媒體檔名', '題目(必填)', '題目多媒體檔名',
        '選項A(必填)', '選項多媒體檔名', '選項B(必填)', '選項多媒體檔名', '選項C',
        '選項多媒體檔名', '選項D', '選項多媒體檔名', '選項E', '選項多媒體檔名',
        '正確答案(必填)', '文字詳解', '文字詳解多媒體檔名', '選項排列',
        '標籤（僅限課程題庫使用）'
    ];
    XLSX.utils.sheet_add_aoa(worksheet, [row10Headers], { origin: 'A10' });

    // Apply merges for Row 2
    worksheet['!merges'] = [
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // A2:E2 '題組資訊'
        { s: { r: 1, c: 5 }, e: { r: 1, c: 7 } }, // F2:H2 '題組共用內容'
        { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } }, // I2:J2 '題目內容'
        { s: { r: 1, c: 10 }, e: { r: 1, c: 19 } },// K2:T2 '選項'
        { s: { r: 1, c: 20 }, e: { r: 1, c: 22 } },// U2:W2 '答案和詳解'
        { s: { r: 1, c: 23 }, e: { r: 1, c: 24 } },// X2:Y2 '設定'
    ];
    
    // Add the actual data starting from row 11 (origin: A11)
    XLSX.utils.sheet_add_aoa(worksheet, dataRows, { origin: 'A11' });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PaGamO 題組');

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
    