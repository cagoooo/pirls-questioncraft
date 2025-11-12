// src/lib/generatePaGamOExcel.ts
'use client';

import * as XLSX from 'xlsx';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import type { Toast } from '@/hooks/use-toast';

type ProgressCallback = (progress: number, message: string) => void;

export async function exportPIRLStoPaGamO(
  questionsOutput: GeneratePirlsQuestionsOutput,
  showToast: typeof Toast,
  updateProgressCallback: ProgressCallback
) {
  try {
    updateProgressCallback(0, '開始準備 PaGamO 資料...');

    const optionLabels = ['A', 'B', 'C', 'D'];

    // Header data based on the PaGamO template.
    const header: (string | null)[][] = [
      ['版本資訊', 'v1.1'],
      ['題目資訊'],
      ['編號(必填)', '科目(必填)', '冊次(必填)', '章節(必填)', '難度'],
      ['說明', '1. 世界地圖重要知識點\n2. 題型，目前系統支援單選題(含是非題)、複選題\n3. 若您不清楚冊次章節可留空，系統將自動為您存放於自訂章節。\n4. 若您想入第一～六冊，請直接輸入1, 2, 3, 4, 5, 6。'],
      ['範例', '國文', '第一冊', '第一章', null],
      [null, '英文', 'B8C', 'Hobbies/Sports', null],
      [],
      [],
      [],
      ['(請勿更動以上內容) 第十一列開始為要上傳的內容，請參照範例填寫，最多可填寫 1,000 列'],
    ];

    const data: (string | number)[][] = [];

    questionsOutput.questions.forEach((q, index) => {
      updateProgressCallback(10 + Math.round(((index + 1) / questionsOutput.questions.length) * 80), `處理題目 ${index + 1} / ${questionsOutput.questions.length}`);
      
      const row: (string | number)[] = new Array(23).fill('');
      
      const options = [...q.options];
      const correctAnswerText = options.splice(q.correctAnswerIndex, 1)[0];
      const correctAnswerLabel = optionLabels[q.correctAnswerIndex];

      row[0] = index + 1;                  // A: 編號
      row[1] = '閱讀素養題組';              // B: 科目
      row[2] = '資訊冊';                      // C: 冊次
      row[3] = '資訊章';                      // D: 章節
      // E is empty
      row[5] = q.question;                   // F: 題目
      // G is empty
      row[7] = correctAnswerText;            // H: 選項A (正確答案)
      // I is empty
      row[9] = options[0] || '';           // J: 選項B
      // K is empty
      row[11] = options[1] || '';          // L: 選項C
      // M is empty
      row[13] = options[2] || '';          // N: 選項D
      // O, P, Q are empty
      row[17] = correctAnswerLabel;          // R: 正確答案 (A, B, C, D)
      // S, T, U, V, W are empty
      
      data.push(row);
    });

    // Duplicate the first 3 questions and insert them after the 3rd question.
    if (data.length >= 3) {
      const firstThreeQuestions = data.slice(0, 3);
      data.splice(3, 0, ...firstThreeQuestions);

      // Re-number all questions after duplication
      data.forEach((row, index) => {
        // Find the original question number (before duplication)
        let originalQuestionIndex;
        if (index < 3) { // 1, 2, 3
            originalQuestionIndex = index;
        } else if (index < 6) { // copied 1, 2, 3
            originalQuestionIndex = index - 3;
        } else { // 4, 5, 6...
            originalQuestionIndex = index - 3;
        }

        // Set question number based on its position in the original, unduplicated sequence
        row[0] = originalQuestionIndex + 1;
      });

      // Special case: re-number the duplicated questions to be 1, 2, 3 again
      data[3][0] = 1;
      data[4][0] = 2;
      data[5][0] = 3;
    }


    const finalData = [...header, ...data];

    updateProgressCallback(90, '正在建立 PaGamO Excel 工作表...');

    const worksheet = XLSX.utils.aoa_to_sheet(finalData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PaGamO 題組');

    updateProgressCallback(95, '準備下載 PaGamO 檔案...');
    XLSX.writeFile(workbook, 'PIRLS_PaGamO_題組.xlsx', { bookSST: true });
    
    updateProgressCallback(100, 'PaGamO 檔案已開始下載！');
    showToast({
      title: "成功下載 PaGamO 檔案",
      description: "PaGamO 題組 Excel 檔案已成功下載。",
      variant: "default",
      className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
    });

  } catch (error: any) {
    console.error("生成 PaGamO 檔案時發生錯誤:", error);
    updateProgressCallback(100, 'PaGamO 檔案生成失敗。');
    showToast({
      title: "PaGamO 生成失敗",
      description: `無法生成 PaGamO 檔案: ${error.message || '未知錯誤'}`,
      variant: "destructive",
    });
  }
}
