// src/lib/generateExcel.ts
'use client';

import * as XLSX from 'xlsx';
import type { GeneratePirlsQuestionsOutput } from '@/lib/api';
import type { Toast } from '@/hooks/use-toast';

type ProgressCallback = (progress: number, message: string) => void;

export async function exportPIRLStoExcel(
  questionsOutput: GeneratePirlsQuestionsOutput,
  showToast: typeof Toast,
  updateProgressCallback: ProgressCallback
) {
  try {
    updateProgressCallback(0, '開始準備 Excel 資料...');
    const headers = [
      "問題 (請勿編輯標題)",
      "務必作答 (若此問題需要回答，請輸入1)",
      "每題得分 (未填入的部分將被自動設為1)",
      "正確答案的選項",
      "說明",
      "選項1",
      "選項2",
      "選項3",
      "選項4"
    ];
    updateProgressCallback(20, '正在轉換題目格式...');

    const data = questionsOutput.questions.map((q, index) => {
      updateProgressCallback(20 + Math.round(((index + 1) / questionsOutput.questions.length) * 50), `處理題目 ${index + 1} / ${questionsOutput.questions.length}`);
      return [
        q.question,
        1, 
        1, 
        q.correctAnswerIndex + 1, 
        q.explanation,
        q.options[0] || "",
        q.options[1] || "",
        q.options[2] || "",
        q.options[3] || ""
      ];
    });

    updateProgressCallback(75, '正在建立 Excel 工作表...');
    const worksheetData = [headers, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    const columnWidths = [
        {wch: 60}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 60},
        {wch: 30}, {wch: 30}, {wch: 30}, {wch: 30}
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PIRLS 題組');

    updateProgressCallback(95, '準備下載 Loilonote 檔案...');
    // The bookSST option is recommended for compatibility with non-standard clients
    XLSX.writeFile(workbook, 'PIRLS_Loilonote_題組.xlsx', { bookSST: true });
    
    updateProgressCallback(100, 'Loilonote 檔案已開始下載！');
    showToast({
      title: "成功下載 Loilonote 檔案",
      description: "PIRLS 題組 Loilonote 檔案已成功下載。請檢查您的下載資料夾。",
      variant: "default",
      className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
    });

  } catch (error: any) {
    console.error("生成 Excel 時發生錯誤:", error);
    updateProgressCallback(100, 'Excel 檔案生成失敗。');
    showToast({
      title: "Excel 生成失敗",
      description: `無法生成 Excel 檔案: ${error.message || '未知錯誤'}`,
      variant: "destructive",
    });
  }
}
