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

    const data: (string | number)[][] = [];

    // Add 10 empty rows to meet PaGamO's format requirement (data starts from row 11)
    for (let i = 0; i < 10; i++) {
      data.push([]);
    }

    questionsOutput.questions.forEach((q, index) => {
      updateProgressCallback(10 + Math.round(((index + 1) / questionsOutput.questions.length) * 80), `處理題目 ${index + 1} / ${questionsOutput.questions.length}`);
      
      const row: (string | number)[] = new Array(23).fill('');
      
      row[0] = index + 1;
      row[1] = '閱讀素養題組';
      row[2] = '資訊冊';
      row[3] = '資訊章';
      row[5] = q.question;
      
      // The correct answer must be in Option A (column H/index 7) for PaGamO.
      const options = [...q.options];
      const correctAnswer = options.splice(q.correctAnswerIndex, 1)[0];
      
      row[7] = correctAnswer; // Option A
      row[9] = options[0] || '';   // Option B
      row[11] = options[1] || '';  // Option C
      row[13] = options[2] || '';  // Option D
      
      data.push(row);
    });

    updateProgressCallback(90, '正在建立 PaGamO Excel 工作表...');

    const worksheet = XLSX.utils.aoa_to_sheet(data);

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
