
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

    // This header is exactly 11 rows to match PaGamO template, with data starting on row 12
    const header: (string | null)[][] = [
        ['版本資訊', 'v1.1', null, null, null, '題組共同內容', null, null, null, '題組個別題目', null, null, null, null, null, null, null, null, null, null, null, '答案', null, null, null],
        ['題目資訊', '科目(必填)', '冊次(必填)', '章節(必填)', '難度', '標題(必填)', '標題多媒體檔名', '內容(必填)', '內容多媒體檔名', '題目(必填)', '題目多媒體檔名', '選項A(必填)', '選項多媒體檔名', '選項B(必填)', '選項多媒體檔名', '選項C', '選項多媒體檔名', '選項D', '選項多媒體檔名', '選項E', '選項多媒體檔名', '正確答案(必填)', '文字詳解', '文字詳解多媒體檔名', '選項排列'],
        ['說明', '1.題組編輯請將相同題組的題目，編輯在同一張Excel中，並使用相同的「科目」、「冊次」、「章節」與「標題」，即可成功設定為題組。\n2.題型，目前系統支援單選題(含是非題)、複選題\n3.若您不清楚冊次章節可留空，系統將自動為您存放於自訂章節。\n4.若您想入第一～六冊，請直接輸入1, 2, 3, 4, 5, 6。', null, null, null, '1.題組標題，限制90個中文字（高於90個中文字，將無法顯示）。\n2.科目、冊次、章節、題組標題相同的題目，將會被歸類在同個題組中。', null, '1.純文字內容，可使用換行，總字數限制3000字。', null, '1.純文字題目，可使用換行。', null, '1.純文字選項，可使用換行。\n2.選項支援JPG,PNG,MP3。\n3.若您需兩個以上的選項，請以”,”分隔。\n4.若答案為複選，請以”,”分隔。', null, null, null, null, null, null, null, null, null, '1.輸入A/B/C/D/E（複選，請以”,”分隔）。', '可填寫文字詳解（搭配詳解多媒體檔名，最多可設定一組）。', null, '1.可選擇所有選項隨機排列，或只有一部分選項隨機排列。'],
        ['範例', '國文', '第一冊', '第一章', '1', '靜夜思', null, '床前明月光，疑是地上霜。舉頭望明月，低頭思故鄉。', null, '這首詩的作者是誰？', null, '李白', null, '杜甫', null, '白居易', null, null, null, null, null, 'A', '唐代詩人李白', null, null],
        [],
        [],
        [],
        [],
        [],
        [],
        ['(請勿更動以上內容) 第十二列開始為要上傳的內容，請參照範例填寫，最多可填寫 1,000 列'],
    ];

    const data: (string | number | null)[][] = [];

    questionsOutput.questions.forEach((q, index) => {
      updateProgressCallback(10 + Math.round(((index + 1) / questionsOutput.questions.length) * 80), `處理題組題目 ${index + 1} / ${questionsOutput.questions.length}`);
      
      const row: (string | number | null)[] = new Array(25).fill(null);
      
      row[0] = index + 1;                                     // A: 編號
      row[1] = '閱讀素養題組';                                  // B: 科目
      row[2] = '資訊冊';                                        // C: 冊次
      row[3] = '資訊章';                                        // D: 章節
      // E: 難度 (null)
      row[5] = articleTitle;                                  // F: 標題
      // G: 標題多媒體檔名 (null) - This is actually H in the screenshot, F is title. User mapping is wrong. Let's follow screenshot
      row[7] = articleContent;                                // H: 內容
      // I: 內容多媒體檔名 (null)
      row[9] = q.question;                                    // J: 題目
      // K: 題目多媒體檔名 (null)
      row[11] = q.options[0] || '';                           // L: 選項A
      // M: 選項A多媒體檔名 (null)
      row[13] = q.options[1] || '';                           // N: 選項B
      // O: 選項B多媒體檔名 (null)
      row[15] = q.options[2] || '';                           // P: 選項C
      // Q: 選項C多媒體檔名 (null)
      row[17] = q.options[3] || '';                           // R: 選項D
      // S, T, U are empty
      row[21] = optionLabels[q.correctAnswerIndex];           // V: 正確答案
      row[22] = q.explanation;                                // W: 文字詳解
      // X, Y are empty
      
      data.push(row);
    });

    const finalData = [...header, ...data];

    updateProgressCallback(90, '正在建立 PaGamO 題組 Excel 工作表...');

    const worksheet = XLSX.utils.aoa_to_sheet(finalData);
    
    // Hide the header rows for cleaner presentation, though PaGamO should ignore them
    worksheet['!rows'] = (worksheet['!rows'] || []);
    for (let i = 0; i < 11; i++) {
        if (!worksheet['!rows'][i]) worksheet['!rows'][i] = {};
        worksheet['!rows'][i].hidden = true;
    }


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
