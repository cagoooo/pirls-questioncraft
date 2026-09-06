// src/lib/generateExcel.ts
'use client';

import { downloadPlatformWorkbook } from './platformExports';
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
    await downloadPlatformWorkbook(questionsOutput, 'loilonote');
    
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
