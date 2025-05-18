// src/lib/generateExcel.ts
'use client';

import * as XLSX from 'xlsx';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import type { Toast } from '@/hooks/use-toast';

type PirlsQuestion = GeneratePirlsQuestionsOutput['questions'][0];

const pirlsLevelLabels: Record<PirlsQuestion['pirlsLevel'], string> = {
  'locate & retrieve': '訊息提取與檢索',
  'make straightforward inferences': '直接推論',
  'interpret & integrate': '詮釋與整合',
  'evaluate & critique': '評估與批判',
};

export async function exportPIRLStoExcel(
  questionsOutput: GeneratePirlsQuestionsOutput,
  showToast: typeof Toast
) {
  try {
    const headers = [
      "問題 (請勿編輯標題)",
      "務必作答 (若此問題需要回答，請輸入1)",
      "每題得分 (未填入的部分將被自動設為1)",
      "正確答案的選項",
      "說明",
      "選項1",
      "選項2",
      "選項3",
      "選項4",
      "PIRLS 層次"
    ];

    const data = questionsOutput.questions.map(q => [
      q.question,
      1, // "務必作答" - static value
      1, // "每題得分" - static value
      q.correctAnswerIndex + 1, // "正確答案的選項" - 1-based index
      q.explanation,
      q.options[0] || "",
      q.options[1] || "",
      q.options[2] || "",
      q.options[3] || "",
      pirlsLevelLabels[q.pirlsLevel] || q.pirlsLevel
    ]);

    const worksheetData = [headers, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths (optional, for better readability)
    // Character width is an approximation.
    const columnWidths = [
        {wch: 60}, // 問題
        {wch: 20}, // 務必作答
        {wch: 20}, // 每題得分
        {wch: 15}, // 正確答案的選項
        {wch: 60}, // 說明
        {wch: 30}, // 選項1
        {wch: 30}, // 選項2
        {wch: 30}, // 選項3
        {wch: 30}, // 選項4
        {wch: 20}  // PIRLS 層次
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PIRLS 題組');

    XLSX.writeFile(workbook, 'PIRLS_QuestionCraft_題組.xlsx');

    showToast({
      title: "成功下載 Excel",
      description: "PIRLS 題組 Excel 檔案已成功下載。請檢查您的下載資料夾。",
      variant: "default",
      className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
    });

  } catch (error: any) {
    console.error("生成 Excel 時發生錯誤:", error);
    showToast({
      title: "Excel 生成失敗",
      description: `無法生成 Excel 檔案: ${error.message || '未知錯誤'}`,
      variant: "destructive",
    });
  }
}
