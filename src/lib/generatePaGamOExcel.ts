// src/lib/generatePaGamOExcel.ts
'use client';

import * as XLSX from 'xlsx';
import type { GeneratePirlsQuestionsOutput } from '@/lib/api';
import type { Toast } from '@/hooks/use-toast';

type ProgressCallback = (progress: number, message: string) => void;

export async function exportPIRLStoPaGamO(
  questionsOutput: GeneratePirlsQuestionsOutput,
  showToast: typeof Toast,
  updateProgressCallback: ProgressCallback
) {
  try {
    updateProgressCallback(0, '開始準備 PaGamO 資料...');

    const header: (string | null)[][] = [
        ['版本資訊', 'v1.1'],
        ['題目資訊'],
        ['編號(必填)', '科目(必填)', '冊次(必填)', '章節(必填)', '難度', '題目(必填)',	'題目多媒體檔名',	'選項A(必填)',	'選項多媒體檔名',	'選項B(必填)',	'選項多媒體檔名',	'選項C',	'選項多媒體檔名',	'選項D',	'選項多媒體檔名',	'選項E',	'選項多媒體檔名',	'正確答案(必填)',	'詳解',	'詳解多媒體檔名',	'出處',	'關鍵字',	'選項排列'],
        ['說明', '1. 世界地圖重要知識點\n2. 題型，目前系統支援單選題(含是非題)、複選題\n3. 若您不清楚冊次章節可留空，系統將自動為您存放於自訂章節。\n4. 若您想入第一～六冊，請直接輸入1, 2, 3, 4, 5, 6。'],
        ['範例', '國文', '第一冊', '第一章', null, '「慈烏失其母」的「慈」字，意思為何？', null, '慈祥', null, '善良', null, '孝順', null, '慈愛', null, null, null, 'C', '慈烏，一種孝鳥，此指孝順。', null, null, null, null],
        [null, '英文', 'B8C', 'Hobbies/Sports', null, 'Which one is a group of fish?', null, 'a school of fish', null, 'a flock of fish', null, 'a herd of fish', null, 'a pack of fish', null, null, null, 'A', 'a school of fish 一群魚。 a flock of Sheep 一群綿羊。 a herd of cattle 一群牛。 a pack of wolves 一群狼', null, null, null, null],
        [],
        [],
        [],
        ['(請勿更動以上內容) 第十一列開始為要上傳的內容，請參照範例填寫，最多可填寫 1,000 列'],
    ];


    const rawData: (string | number)[][] = [];

    questionsOutput.questions.forEach((q, index) => {
      updateProgressCallback(10 + Math.round(((index + 1) / questionsOutput.questions.length) * 40), `處理題目 ${index + 1} / ${questionsOutput.questions.length}`);
      
      const row: (string | number)[] = new Array(23).fill('');
      
      const options = [...q.options];
      const correctAnswerText = options.splice(q.correctAnswerIndex, 1)[0];
      const finalOptions = [correctAnswerText, ...options];
      const correctAnswerLabel = 'A';

      row[0] = index + 1;                  // A: 編號
      row[1] = '閱讀素養題組';              // B: 科目
      row[2] = '資訊冊';                      // C: 冊次
      row[3] = '資訊章';                      // D: 章節
      row[5] = q.question;                   // F: 題目
      row[7] = finalOptions[0] || '';        // H: 選項A (正確答案)
      row[9] = finalOptions[1] || '';        // J: 選項B
      row[11] = finalOptions[2] || '';       // L: 選項C
      row[13] = finalOptions[3] || '';       // N: 選項D
      row[17] = correctAnswerLabel;          // R: 正確答案 (A, B, C, D)
      row[18] = q.explanation;               // S: 詳解
      
      rawData.push(row);
    });

    updateProgressCallback(50, '正在複製前三題...');
    
    let finalDataRows = [...rawData];
    if (rawData.length >= 3) {
      const questionsToDuplicate = rawData.slice(0, 3);
      finalDataRows.splice(3, 0, ...questionsToDuplicate);
    }
    
    // The data is now prepared, it will be added after the header
    const finalSheetData = [...header, ...finalDataRows];

    updateProgressCallback(90, '正在建立 PaGamO Excel 工作表...');

    const worksheet = XLSX.utils.aoa_to_sheet(finalSheetData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PaGamO 題組');

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
