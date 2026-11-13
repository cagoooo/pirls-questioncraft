// LoiLoNote 測驗卡匯入檔：buildLegacyWorkbook＝與網站相同的九欄格式（只有題目）；buildWorkbook＝v1.2.0 含文章版。
// 格式依 LoiLoNote 官方說明與官方範例檔（2026-11-13 核對）：
//   第 1 列 A1＝版本「v1.2.0」，第 2 列＝欄名（不可刪），第 3 列起每列一題。
//   A 題型｜B 題目｜C 務必作答（1）｜D 配分｜E 正確答案編號（從 G 欄算起）｜F 解說｜G～J 選項
//   題型 questionOnly＝只有題目、不作答（只讀 B 與 F 欄），用來放閱讀文章，後面接單選題 radio＝題組。
// 一般 script（不是 module），網頁與 Node 測試都能載入。需要先載入 vendor/xlsx.full.min.js。
(function (global) {
  'use strict';

  var VERSION = 'v1.2.0';
  // 與官方繁中範例檔第 2 列完全相同（官方範例檔的欄名是英文）
  var HEADERS = ['Question Type', 'Question', 'Answer Required', 'Score', 'Correct answer(s)', 'Explanation',
    'Choices or Correct Answer 1', 'Choices or Correct Answer 2', 'Choices or Correct Answer 3', 'Choices or Correct Answer 4', '…'];
  // 官方範本 Excel 資料驗證的長度上限（「少於」N 字），超過可能匯入失敗且不會顯示錯誤
  var MAX_QUESTION = 999;
  var MAX_EXPLANATION = 9999;
  var MAX_OPTION = 499;
  var MAX_ROWS = 300; // 每張測驗卡最多 300 題（含文章項目）
  var PASSAGE_INTRO = '請先閱讀下面的文章，再回答後面的問題。';

  function validate(data) {
    var errors = [];
    if (!data || !Array.isArray(data.questions) || !data.questions.length) return ['請先產生至少一題。'];
    data.questions.forEach(function (q, i) {
      var n = '第 ' + (i + 1) + ' 題：';
      if (typeof q.question !== 'string' || !q.question.trim()) errors.push(n + '題幹不可空白。');
      else if (q.question.length > MAX_QUESTION) errors.push(n + '題幹 ' + q.question.length + ' 字，LoiLoNote 題目要少於 1000 字。');
      if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(n + '必須恰好有四個選項。');
      (q.options || []).forEach(function (o, j) {
        if (typeof o !== 'string' || !o.trim()) errors.push(n + '選項 ' + (j + 1) + ' 不可空白。');
        else if (o.length > MAX_OPTION) errors.push(n + '選項 ' + (j + 1) + ' 有 ' + o.length + ' 字，LoiLoNote 選項要少於 500 字。');
      });
      if (!Number.isInteger(q.correctAnswerIndex) || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) errors.push(n + '正確答案必須是第 1～4 項。');
      if (typeof q.explanation === 'string' && q.explanation.length > MAX_EXPLANATION) errors.push(n + '解說超過 LoiLoNote 的 10000 字上限。');
    });
    return errors;
  }

  // 把長文切成每段不超過 limit 字：優先在換行處切，其次在句號等標點處切，最後才硬切
  function chunkText(text, limit) {
    var rest = String(text).replace(/\r\n?/g, '\n').trim();
    var parts = [];
    while (rest.length > limit) {
      var cut = rest.lastIndexOf('\n', limit);
      if (cut < limit * 0.5) {
        var best = -1;
        ['。', '！', '？', '；', '.', '!', '?'].forEach(function (p) { best = Math.max(best, rest.lastIndexOf(p, limit - 1)); });
        cut = best >= limit * 0.5 ? best + 1 : limit;
      }
      parts.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    return parts;
  }

  // 文章變成一或多個 questionOnly 項目（B 欄少於 1000 字）
  function passageItems(title, article) {
    title = String(title || '').trim();
    article = String(article || '').trim();
    if (!article) return [];
    var head = PASSAGE_INTRO + '\n\n' + (title ? '《' + title + '》\n\n' : '');
    var single = head + article;
    if (single.length <= MAX_QUESTION) return [single];
    // 分成多段：每段前面加「（文章第 k／n 段）」，預留標頭長度
    var reserve = head.length + 20;
    var chunks = chunkText(article, MAX_QUESTION - reserve);
    return chunks.map(function (c, k) {
      var tag = '（文章第 ' + (k + 1) + '／' + chunks.length + ' 段）\n';
      return (k === 0 ? head : '') + tag + c;
    });
  }

  /**
   * @param data { title, articleContent, questions[] }
   * @param opts { title, article }：要寫進檔案的文章標題與內容（預設取 data）
   */
  function buildWorkbook(data, opts) {
    var XLSX = global.XLSX;
    opts = opts || {};
    var errors = validate(data);
    if (errors.length) throw new Error(errors.join('\n'));
    var title = opts.title != null ? opts.title : data.title;
    var article = opts.article != null ? opts.article : data.articleContent;
    var passages = passageItems(title, article);
    if (passages.length + data.questions.length > MAX_ROWS) throw new Error('LoiLoNote 每張測驗卡最多 300 題（含文章），請分批匯出。');

    var rows = [[VERSION], HEADERS.slice()];
    passages.forEach(function (p) { rows.push(['questionOnly', p]); });
    data.questions.forEach(function (q) {
      rows.push(['radio', q.question, 1, 1, q.correctAnswerIndex + 1, q.explanation || ''].concat(q.options));
    });
    var sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 14 }, { wch: 60 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 40 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Import');
    return wb;
  }

  // 舊版九欄格式（無版本列、無題型欄）：與網站「匯出 Loilonote」完全相同（src/lib/platformExports.ts LOILO_HEADERS），
  // 是老師一直在用的格式；只有題目，不含文章。
  var LEGACY_HEADERS = [
    '問題（請勿編輯標題）', '務必作答（若此問題需要回答，請輸入1）',
    '每題得分（未填入的部分將被自動設為1）',
    '正確答案的選項（若有複數正確答案選項，請用「、」或「 , 」來分隔選項編號）',
    '說明', '選項1', '選項2', '選項3', '選項4',
  ];

  function buildLegacyWorkbook(data) {
    var XLSX = global.XLSX;
    var errors = validate(data);
    if (errors.length) throw new Error(errors.join('\n'));
    if (data.questions.length > MAX_ROWS) throw new Error('LoiLoNote 每張測驗卡最多 300 題，請分批匯出。');
    var rows = data.questions.map(function (q) {
      return [q.question, 1, 1, q.correctAnswerIndex + 1, q.explanation].concat(q.options);
    });
    var sheet = XLSX.utils.aoa_to_sheet([LEGACY_HEADERS.slice()].concat(rows));
    sheet['!cols'] = LEGACY_HEADERS.map(function () { return { wch: 28 }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, '題目');
    return wb;
  }

  function safeName(s) {
    return String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'PIRLS 閱讀題組';
  }

  // LoiLoNote 會把檔名當成測驗卡標題，所以只用文章標題
  function fileName(data, opts) {
    var title = opts && opts.title != null ? opts.title : data.title;
    return safeName(title) + '.xlsx';
  }

  // opts.legacy：true＝舊版九欄（只有題目）；否則 v1.2.0 題組（文章＋題目）
  function download(data, opts) {
    var wb = opts && opts.legacy ? buildLegacyWorkbook(data) : buildWorkbook(data, opts);
    var name = fileName(data, opts);
    global.XLSX.writeFile(wb, name, { bookSST: true });
    return name;
  }

  global.PirlsLoilo = {
    VERSION: VERSION, HEADERS: HEADERS, validate: validate, chunkText: chunkText, passageItems: passageItems,
    LEGACY_HEADERS: LEGACY_HEADERS, buildWorkbook: buildWorkbook, buildLegacyWorkbook: buildLegacyWorkbook,
    fileName: fileName, download: download,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
