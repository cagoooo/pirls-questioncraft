
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

    // This header is exactly 11 rows to match PaGamO template
    const header: (string | null)[][] = [
      ['版本資訊', 'v1.1'],
      ['題目資訊'],
      ['編號(必填)', '科目(必填)', '冊次(必填)', '章節(必填)', '難度', '標題(必填)', '標題多媒體檔名', '內容(必填)', '內容多媒體檔名', '題目(必填)', '題目多媒體檔名', '選項A(必填)', '選項多媒體檔名', '選項B(必填)', '選項多媒體檔名', '選項C', '選項多媒體檔名', '選項D', '選項多媒體檔名', '選項E', '選項多媒體檔名', '正確答案(必填)', '文字詳解', '文字詳解多媒體檔名', '選項排列'],
      ['說明', '1. 世界地圖重要知識點\n2. 題型，目前系統支援單選題(含是非題)、複選題\n3. 若您不清楚冊次章節可留空，系統將自動為您存放於自訂章節。\n4. 若您想入第一～六冊，請直接輸入1, 2, 3, 4, 5, 6。'],
      ['範例', '國文', '第一冊', '第一章', null, '靜夜思', null, '床前明月光，疑是地上霜。舉頭望明月，低頭思故鄉。', null, '這首詩的作者是誰？', null, '李白', null, '杜甫', null, '白居易', null, null, null, null, null, 'A', '唐代詩人李白'],
      [],
      [],
      [],
      [],
      ['(請勿更動以上內容) 第十一列開始為要上傳的內容，請參照範例填寫，最多可填寫 1,000 列'],
      [], // Empty row to make data start on row 12
    ];

    const data: (string | number)[][] = [];

    questionsOutput.questions.forEach((q, index) => {
      updateProgressCallback(10 + Math.round(((index + 1) / questionsOutput.questions.length) * 80), `處理題組題目 ${index + 1} / ${questionsOutput.questions.length}`);
      
      const row: (string | number | null)[] = new Array(25).fill(null);
      
      row[0] = index + 1;                  // 編號
      row[1] = '閱讀素養題組';              // 科目
      row[2] = '資訊冊';                    // 冊次
      row[3] = '資訊章';                    // 章節
      // 4: 難度 (null)
      row[5] = articleTitle;               // 標題
      // 6: 標題多媒體檔名 (null)
      row[7] = articleContent;             // 內容
      // 8: 內容多媒體檔名 (null)
      row[9] = q.question;                 // 題目
      // 10: 題目多媒體檔名 (null)
      row[11] = q.options[0] || '';        // 選項A
      // 12: 選項A多媒體檔名 (null)
      row[13] = q.options[1] || '';        // 選項B
      // 14: 選項B多媒體檔名 (null)
      row[15] = q.options[2] || '';        // 選項C
      // 16: 選項C多媒體檔名 (null)
      row[17] = q.options[3] || '';        // 選項D
      // 18: 選項D多媒體檔名 (null)
      // 19: 選項E (null)
      // 20: 選項E多媒體檔名 (null)
      row[21] = optionLabels[q.correctAnswerIndex]; // 正確答案
      row[22] = q.explanation;             // 文字詳解
      // 23: 文字詳解多媒體檔名 (null)
      // 24: 選項排列 (null)
      
      data.push(row as (string|number)[]);
    });

    const finalData = [...header, ...data];

    updateProgressCallback(90, '正在建立 PaGamO 題組 Excel 工作表...');

    const worksheet = XLSX.utils.aoa_to_sheet(finalData);
    
    // Hide the header rows
    worksheet['!rows'] = (worksheet['!rows'] || []).slice(0, 11);
    for (let i = 0; i < 11; i++) {
        if (!worksheet['!rows'][i]) worksheet['!rows'][i] = {};
        worksheet['!rows'][i].hidden = true;
    }


    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PaGamO 題組');

    updateProgressCallback(95, '準備下載 PaGamO 題組檔案...');
    XLSX.writeFile(workbook, 'PIRLS_PaGamO_選擇題.xlsx', { bookSST: true });
    
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
