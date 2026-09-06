import * as XLSX from 'xlsx';
import type { GeneratePirlsQuestionsOutput } from './api';
import templates from './pagamoTemplates.json';
import { assertExportable } from './platformExports';

export function buildPaGamOWorkbook(data: GeneratePirlsQuestionsOutput, group = false, title = data.title, article = data.articleContent) {
  assertExportable(data);
  if (data.questions.length + (group ? 1 : 0) > 1000) throw new Error('PaGamO 一次最多匯出 1,000 列（題組包含文章列）。');
  if (group && (!title.trim() || !article.trim())) throw new Error('題組必須包含文章標題與內容。');
  if (group && (title.length > 32767 || article.length > 32767)) throw new Error('文章超過 Excel 單格長度，請先分篇。');
  const template = templates[group ? 'group' : 'choice'];
  const rows: (string | number | null)[][] = template.headers.map(row => [...row]);
  if (group) {
    const heading: (string | number | null)[] = Array(25).fill(null);
    heading[0] = 1; heading[1] = '閱讀素養題組'; heading[2] = '資訊冊'; heading[3] = '資訊章';
    heading[5] = title; heading[6] = article;
    rows.push(heading);
  }
  data.questions.forEach((q, i) => {
    const row: (string | number | null)[] = Array(group ? 25 : 23).fill(null);
    row[0] = group ? `1_${i + 1}` : i + 1;
    if (!group) { row[1] = '閱讀素養題組'; row[2] = '資訊冊'; row[3] = '資訊章'; }
    row[group ? 8 : 5] = q.question;
    q.options.forEach((option, j) => { row[(group ? 10 : 7) + j * 2] = option; });
    row[group ? 20 : 17] = 'ABCD'[q.correctAnswerIndex];
    row[group ? 21 : 18] = q.explanation;
    row[group ? 23 : 20] = 'x'; // Preserve the teacher's option order.
    rows.push(row);
  });
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!merges'] = template.merges.map(m => ({ s: { ...m.s }, e: { ...m.e } }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, template.sheetName);
  return book;
}
