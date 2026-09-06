// src/lib/generatePaGamOExcel.ts
'use client';

import * as XLSX from 'xlsx';
import { buildPaGamOWorkbook } from './buildPaGamOWorkbook';
import type { GeneratePirlsQuestionsOutput } from '@/lib/api';
import type { Toast } from '@/hooks/use-toast';

type ProgressCallback = (progress: number, message: string) => void;

export async function exportPIRLStoPaGamO(
  questionsOutput: GeneratePirlsQuestionsOutput,
  showToast: typeof Toast,
  updateProgressCallback: ProgressCallback
) {
  try {
    updateProgressCallback(20, '正在依 PaGamO 官方範本建立題目...');
    const workbook = buildPaGamOWorkbook(questionsOutput);

    updateProgressCallback(95, '準備下載 PaGamO 檔案...');
    XLSX.writeFile(workbook, 'PIRLS_PaGamO_選擇題.xlsx', { bookSST: true });
    
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
