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
    updateProgressCallback(0, '開始準備 PaGamO 題組資料 (v1.0 格式)...');

    const optionLabels = ['A', 'B', 'C', 'D'];

    // Header has 10 rows. Data will start on row 11.
    const header: (string | null)[][] = [
        ['版本資訊', 'v1.0'],
        ['題目資訊', '科目(必填)', '冊次(必填)', '章節(必填)', '難度', '題組共同內容', null, null, null, '題組個別題目'],
        ['說明', '1.題組編輯請將相同題組的題目，編輯在同一張Excel中，並使用相同的「科目」、「冊次」、「章節」與「標題」，即可成功設定為題組。\n2.題型，目前系統支援單選題(含是非題)、複選題\n3.若您不清楚冊次章節可留空，系統將自動為您存放於自訂章節。\n4.若您想入第一～六冊，請直接輸入1, 2, 3, 4, 5, 6。', null, null, null, '1.題組標題，限制90個中文字（高於90個中文字，將無法顯示）。\n2.科目、冊次、章節、題組標題相同的題目，將會被歸類在同個題組中。', null, '1.純文字內容，可使用換行，總字數限制3000字。', null, '1.純文字題目，可使用換行。', null, '1.純文字選項，可使用換行。\n2.選項支援JPG,PNG,MP3。\n3.若您需兩個以上的選項，請以”,”分隔。\n4.若答案為複選，請以”,”分隔。', null, null, null, null, null, null, '1.輸入A/B/C/D/E（複選，請以”,”分隔）。', '可填寫文字詳解（搭配詳解多媒體檔名，最多可設定一組）。', null, '1.可選擇所有選項隨機排列，或只有一部分選項隨機排列。'],
        ['範例', '國文', '第一冊', '第一章', '1', '靜夜思', null, '床前明月光，疑是地上霜。舉頭望明月，低頭思故鄉。', null, '這首詩的作者是誰？', null, '李白', null, '杜甫', null, '白居易', null, null, null, null, null, 'A', '唐代詩人李白', null, null],
        [],
        [],
        [],
        [],
        [],
        ['(請勿更動以上內容) 第十一列開始為要上傳的內容，請參照範例填寫，最多可填寫 1,000 列'],
    ];

    // Create the "Question Group Header" row (the "題組題本")
    const groupHeaderRow: (string | number | null)[] = new Array(25).fill(null);
    groupHeaderRow[0] = 1; // A: 編號
    groupHeaderRow[1] = '閱讀素養題組'; // B: 科目
    groupHeaderRow[2] = '資訊冊'; // C: 冊次
    groupHeaderRow[3] = '資訊章'; // D: 章節
    groupHeaderRow[5] = articleTitle; // F: 標題
    groupHeaderRow[7] = articleContent; // H is incorrect, it should be G. G is index 6.
    
    // Correct mapping for group header
    const finalGroupHeaderRow: (string | number | null)[] = new Array(25).fill(null);
    finalGroupHeaderRow[0] = 1; // A: 編號
    finalGroupHeaderRow[1] = '閱讀素養題組'; // B: 科目
    finalGroupHeaderRow[2] = '資訊冊'; // C: 冊次
    finalGroupHeaderRow[3] = '資訊章'; // D: 章節
    finalGroupHeaderRow[5] = articleTitle; // F: 標題
    finalGroupHeaderRow[6] = articleContent; // G: 內容(必填)


    const questionDataRows: (string | number | null)[][] = [];

    questionsOutput.questions.forEach((q, index) => {
      updateProgressCallback(10 + Math.round(((index + 1) / questionsOutput.questions.length) * 80), `處理題組題目 ${index + 1} / ${questionsOutput.questions.length}`);
      
      const row: (string | number | null)[] = new Array(25).fill(null);
      
      // Correct v1.0 Format Mapping for individual questions
      row[0] = `1_${index + 1}`;                     // A: 編號 (e.g., 1_1, 1_2)
      row[1] = '閱讀素養題組';                        // B: 科目
      row[2] = '資訊冊';                              // C: 冊次
      row[3] = '資訊章';                              // D: 章節
      row[5] = articleTitle;                          // F: 標題 (must be same as group header)
      // G and H are empty for question rows
      row[8] = q.question;                            // I: 題目(必填)
      row[10] = q.options[0] || '';                   // K: 選項A
      row[12] = q.options[1] || '';                   // M: 選項B
      row[14] = q.options[2] || '';                   // O: 選項C
      row[16] = q.options[3] || '';                   // Q: 選項D
      row[20] = optionLabels[q.correctAnswerIndex];   // U: 正確答案
      row[21] = q.explanation;                        // V: 文字詳解
      
      questionDataRows.push(row);
    });

    const finalData = [...header, finalGroupHeaderRow, ...questionDataRows];

    updateProgressCallback(90, '正在建立 PaGamO 題組 Excel 工作表...');

    const worksheet = XLSX.utils.aoa_to_sheet(finalData, {cellDates: false, sheetStubs: true});
    
    // Setup merged cells for the header as seen in the template
    worksheet['!merges'] = [
        // Merges for row 2: "題組共同內容" and "題組個別題目"
        { s: { r: 1, c: 5 }, e: { r: 1, c: 7 } }, // Merge F2:H2 for "題組共同內容"
        { s: { r: 1, c: 8 }, e: { r: 1, c: 24 } },// Merge I2:Y2 for "題組個別題目"
    ];
    
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
    