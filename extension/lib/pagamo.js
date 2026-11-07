// PaGamO 批量上傳檔：移植自網站 src/lib/buildPaGamOWorkbook.ts（已在 PaGamO 實際上傳驗證過的格式）。
// 一般 script（不是 module），讓網頁與 Node 測試都能載入。需要先載入 vendor/xlsx.full.min.js 與 lib/pagamoTemplates.js。
(function (global) {
  'use strict';

  function validate(data) {
    var errors = [];
    if (!data || !Array.isArray(data.questions) || !data.questions.length) return ['請先產生至少一題。'];
    data.questions.forEach(function (q, i) {
      var n = '第 ' + (i + 1) + ' 題：';
      if (typeof q.question !== 'string' || !q.question.trim()) errors.push(n + '題幹不可空白。');
      if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(n + '必須恰好有四個選項。');
      (q.options || []).forEach(function (o, j) {
        if (typeof o !== 'string' || !o.trim()) errors.push(n + '選項 ' + (j + 1) + ' 不可空白。');
      });
      if (!Number.isInteger(q.correctAnswerIndex) || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) errors.push(n + '正確答案必須是第 1～4 項。');
      [q.question].concat(q.options || [], [q.explanation]).forEach(function (v) {
        if (typeof v === 'string' && v.length > 32767) errors.push(n + '內容超過 Excel 單格可容納的長度。');
      });
    });
    return errors;
  }

  /**
   * @param data { title, articleContent, questions[] }
   * @param opts { group, subject, book, chapter, title, article }
   */
  function buildWorkbook(data, opts) {
    var XLSX = global.XLSX;
    var templates = global.PAGAMO_TEMPLATES;
    opts = opts || {};
    var group = !!opts.group;
    var subject = opts.subject || '閱讀素養題組';
    var book = opts.book || '資訊冊';
    var chapter = opts.chapter || '資訊章';
    var title = opts.title != null ? opts.title : data.title;
    var article = opts.article != null ? opts.article : data.articleContent;

    var errors = validate(data);
    if (errors.length) throw new Error(errors.join('\n'));
    if (data.questions.length + (group ? 1 : 0) > 1000) throw new Error('PaGamO 一次最多匯出 1,000 列（題組包含文章列）。');
    if (group && (!String(title).trim() || !String(article).trim())) throw new Error('題組必須包含文章標題與內容。');
    if (group && (title.length > 32767 || article.length > 32767)) throw new Error('文章超過 Excel 單格長度，請先分篇。');

    var template = templates[group ? 'group' : 'choice'];
    var rows = template.headers.map(function (row) { return row.slice(); });
    if (group) {
      var heading = new Array(25).fill(null);
      heading[0] = 1; heading[1] = subject; heading[2] = book; heading[3] = chapter;
      heading[5] = title; heading[6] = article;
      rows.push(heading);
    }
    data.questions.forEach(function (q, i) {
      var row = new Array(group ? 25 : 23).fill(null);
      row[0] = group ? '1_' + (i + 1) : i + 1;
      if (!group) { row[1] = subject; row[2] = book; row[3] = chapter; }
      row[group ? 8 : 5] = q.question;
      q.options.forEach(function (option, j) { row[(group ? 10 : 7) + j * 2] = option; });
      row[group ? 20 : 17] = 'ABCD'[q.correctAnswerIndex];
      row[group ? 21 : 18] = q.explanation;
      row[group ? 23 : 20] = 'x'; // 保留老師排好的選項順序（不隨機）
      rows.push(row);
    });
    var sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!merges'] = template.merges.map(function (m) { return { s: Object.assign({}, m.s), e: Object.assign({}, m.e) }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, template.sheetName);
    return wb;
  }

  function safeName(s) {
    return String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || '題組';
  }

  function fileName(data, group) {
    return 'PIRLS_PaGamO_' + (group ? '題組' : '選擇題') + '_' + safeName(data.title) + '.xlsx';
  }

  function download(data, opts) {
    var wb = buildWorkbook(data, opts);
    var name = fileName(data, opts && opts.group);
    global.XLSX.writeFile(wb, name, { bookSST: true });
    return name;
  }

  /** 產生 xlsx 位元組（第 2 階段要放進 PaGamO 上傳欄位時使用） */
  function toBytes(data, opts) {
    return global.XLSX.write(buildWorkbook(data, opts), { type: 'array', bookType: 'xlsx', bookSST: true });
  }

  global.PirlsPagamo = { validate: validate, buildWorkbook: buildWorkbook, download: download, toBytes: toBytes, fileName: fileName };
})(typeof globalThis !== 'undefined' ? globalThis : this);
