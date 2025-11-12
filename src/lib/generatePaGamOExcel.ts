
// src/lib/generatePaGamOExcel.ts
'use client';

import * as XLSX from 'xlsx';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import type { Toast } from '@/hooks/use-toast';

type ProgressCallback = (progress: number, message: string) => void;

// Helper to convert array of arrays to a TSV string
const aoaToTsv = (data: (string | number)[][]): string => {
  return data.map(row => row.join('\t')).join('\n');
};

export async function exportPIRLStoPaGamO(
  questionsOutput: GeneratePirlsQuestionsOutput,
  showToast: typeof Toast,
  updateProgressCallback: ProgressCallback
) {
  try {
    updateProgressCallback(0, '開始準備 PaGamO 資料...');
    
    // According to the prompt, PaGamO format does not use headers.
    // The structure is fixed with 23 columns.

    const data = questionsOutput.questions.map((q, index) => {
      updateProgressCallback(10 + Math.round(((index + 1) / questionsOutput.questions.length) * 80), `處理題目 ${index + 1} / ${questionsOutput.questions.length}`);
      
      const row: (string | number)[] = new Array(23).fill('');
      
      // A. Static Fields
      row[1] = '閱讀素養題組';
      row[2] = '資訊冊';
      row[3] = '資訊章';

      // B. Dynamic Fields
      row[0] = index + 1; // 編號 (starts from 1)
      row[5] = q.question; // 題目
      
      // PaGamO expects answer options in specific columns, not necessarily contiguous
      // It also requires correct answer to be in a specific field which is not provided in this format.
      // The format from the user prompt has correct answer in a specific field which is not used here.
      // The prompt also seems to imply a single answer question type.
      // Based on the prompt, the correct answer should be implicitly Option A. Let's adjust.
      // The prompt also says "if the question does not need C, leave it blank". This suggests not all questions have 4 options.
      // But the input data has 4 options. We will provide all 4.

      // Let's re-map the options. The correct answer will be option A (column 8).
      const options = [...q.options];
      const correctAnswer = options.splice(q.correctAnswerIndex, 1)[0];
      
      row[7] = correctAnswer;  // Options are re-ordered. Correct is always A.
      row[9] = options[0] || '';
      row[11] = options[1] || '';
      row[13] = options[2] || '';
      
      return row;
    });

    updateProgressCallback(90, '正在建立 PaGamO Excel 工作表...');

    // Since the format is strict and doesn't use headers, we'll build a worksheet from an array of arrays.
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // PaGamO format doesn't need specific column widths, but we can add them for readability if opened in Excel.
    // Let's skip this for now to adhere strictly to the PaGamO generation rules.

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PaGamO 題組');

    updateProgressCallback(95, '準備下載 PaGamO 檔案...');
    XLSX.writeFile(workbook, 'PIRLS_PaGamO_題組.xlsx');
    
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
