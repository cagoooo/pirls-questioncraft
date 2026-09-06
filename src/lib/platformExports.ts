import * as XLSX from 'xlsx';
import type { GeneratePirlsQuestionsOutput } from './api';

export type ExportPlatform = 'wayground' | 'loilonote' | 'wordwall' | 'kahoot';
export const PLATFORM_NAMES: Record<ExportPlatform, string> = {
  wayground: 'Wayground', loilonote: 'LoiLoNote（九欄相容版）', wordwall: 'Wordwall（複製貼上）', kahoot: 'Kahoot',
};
export const TIME_OPTIONS = [5, 10, 20, 30, 60, 120];
export const LOILO_HEADERS = [
  '問題（請勿編輯標題）', '務必作答（若此問題需要回答，請輸入1）',
  '每題得分（未填入的部分將被自動設為1）',
  '正確答案的選項（若有複數正確答案選項，請用「、」或「 , 」來分隔選項編號）',
  '說明', '選項1', '選項2', '選項3', '選項4',
];
export const WAYGROUND_HEADERS = ['Question Text', 'Question Type', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5', 'Correct Answer', 'Time in seconds', 'Image Link', 'Answer explanation'];
export interface ExportIssue { question: number; message: string; severity: 'error' | 'warning' }

// UTF-16 length is deliberately conservative for supplementary characters.
export function validateExport(data: GeneratePirlsQuestionsOutput, platform?: ExportPlatform, seconds = 60): ExportIssue[] {
  const issues: ExportIssue[] = [];
  const add = (question: number, message: string, severity: 'error' | 'warning' = 'error') => issues.push({ question, message, severity });
  if (!Array.isArray(data.questions) || !data.questions.length) {
    add(0, '請先產生至少一題。');
    return issues;
  }
  if ((platform === 'kahoot' || platform === 'wayground') && !TIME_OPTIONS.includes(seconds)) add(0, '請選擇提供的作答秒數。');
  if (platform === 'kahoot' && data.questions.length > 200) add(0, '目前 Kahoot 範本一次最多輸出 200 題，請先分批。');
  data.questions.forEach((q, i) => {
    const n = i + 1;
    if (typeof q.question !== 'string' || !q.question.trim()) add(n, '題幹不可空白。');
    if (!Array.isArray(q.options) || q.options.length !== 4) add(n, '必須恰好有四個選項。');
    const options = Array.isArray(q.options) ? q.options : [];
    options.forEach((option, j) => {
      if (typeof option !== 'string' || !option.trim()) add(n, `選項 ${j + 1} 不可空白。`);
      if (platform === 'kahoot' && typeof option === 'string' && option.length > 60) add(n, `選項 ${j + 1} 為 ${option.length} 字，超過目前保守設定 60 字，請調整匯出副本。`);
    });
    if (!Number.isInteger(q.correctAnswerIndex) || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) add(n, '正確答案必須是第 1～4 項。');
    if (new Set(options.filter(o => typeof o === 'string').map(o => o.trim())).size < options.length) add(n, '有重複選項，請確認是否合適。', 'warning');
    if (platform === 'kahoot' && typeof q.question === 'string' && q.question.length > 95) add(n, `題幹為 ${q.question.length} 字，超過目前保守設定 95 字，請調整匯出副本。`);
    [q.question, ...options, q.explanation].forEach(value => {
      if (typeof value === 'string' && value.length > 32767) add(n, '內容超過 Excel 單格可容納的長度。');
    });
  });
  return issues;
}

export function assertExportable(data: GeneratePirlsQuestionsOutput, platform?: ExportPlatform, seconds = 60) {
  const errors = validateExport(data, platform, seconds).filter(i => i.severity === 'error');
  if (errors.length) throw new Error(errors.map(i => `${i.question ? `第 ${i.question} 題：` : ''}${i.message}`).join('\n'));
}

export function buildPlatformWorkbook(data: GeneratePirlsQuestionsOutput, platform: ExportPlatform, seconds = 60, template?: XLSX.WorkBook): XLSX.WorkBook {
  assertExportable(data, platform, seconds);
  const rows = data.questions.map((q, i) => {
    const answer = q.correctAnswerIndex + 1;
    switch (platform) {
      case 'wayground': return [q.question, 'Multiple Choice', ...q.options, '', answer, seconds, '', q.explanation];
      case 'loilonote': return [q.question, 1, 1, answer, q.explanation, ...q.options];
      case 'wordwall': return [q.question, ...q.options, answer];
      case 'kahoot': return [i + 1, q.question, ...q.options, seconds, String(answer)];
    }
  });
  const workbook = XLSX.utils.book_new();
  let sheet: XLSX.WorkSheet;
  let name = '題目';
  if (platform === 'kahoot' || platform === 'wayground') {
    if (!template?.SheetNames.length) throw new Error('官方範本未載入，請稍後重試。');
    name = template.SheetNames[0];
    const source = template.Sheets[name];
    const start = platform === 'kahoot' ? 8 : 2;
    const width = platform === 'kahoot' ? 8 : 11;
    // Keep the template's instruction/header rows, discard ALL sample questions.
    const headers = XLSX.utils.sheet_to_json<(string | number | null)[]>(source, { header: 1, defval: null, blankrows: true }).slice(0, start);
    sheet = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
    sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: start + rows.length - 1, c: width - 1 } });
    if (source['!merges']) sheet['!merges'] = source['!merges'].filter(m => m.e.r < start).map(m => ({ s: { ...m.s }, e: { ...m.e } }));
  } else {
    const headers = platform === 'loilonote' ? LOILO_HEADERS : ['Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Correct Answer'];
    sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  }
  sheet['!cols'] = Array.from({ length: platform === 'wayground' ? 11 : platform === 'loilonote' ? 9 : platform === 'kahoot' ? 8 : 6 }, () => ({ wch: 28 }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
  return workbook;
}

export async function downloadPlatformWorkbook(data: GeneratePirlsQuestionsOutput, platform: ExportPlatform, seconds = 60) {
  assertExportable(data, platform, seconds);
  let template: XLSX.WorkBook | undefined;
  if (platform === 'kahoot' || platform === 'wayground') {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/export-templates/${platform}.xlsx`);
    if (!response.ok) throw new Error('無法載入匯出範本，請重新整理後再試。');
    template = XLSX.read(await response.arrayBuffer(), { type: 'array' });
  }
  XLSX.writeFile(buildPlatformWorkbook(data, platform, seconds, template), `PIRLS_${platform}_題目.xlsx`, { bookSST: true });
}

export function cloneQuestionSet(data: GeneratePirlsQuestionsOutput): GeneratePirlsQuestionsOutput {
  return { ...data, questions: data.questions.map(q => ({ ...q, options: [...q.options] })) };
}

export function downloadTeacherBackup(original: GeneratePirlsQuestionsOutput, exported: GeneratePirlsQuestionsOutput, platform: ExportPlatform) {
  const blob = new Blob([JSON.stringify({ format: 'pirls-teacher-backup', version: 1, platform, original, exported }, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'PIRLS_教師題庫備份.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
