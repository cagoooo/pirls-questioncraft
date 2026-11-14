// 把網站的 PaGamO 官方範本表頭同步進擴充套件（extension/lib/pagamoTemplates.js）。
// 更新 src/lib/pagamoTemplates.json（tools/extract-pagamo-templates.cjs）之後執行，再跑 npm test。
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const json = fs.readFileSync(path.join(root, 'src/lib/pagamoTemplates.json'), 'utf8');
JSON.parse(json); // 確認格式正確
const out = `// 自動產生，請勿手動修改：由 tools/sync-extension.cjs 從 src/lib/pagamoTemplates.json 同步。
globalThis.PAGAMO_TEMPLATES = ${json.trim()};
`;
fs.writeFileSync(path.join(root, 'extension/lib/pagamoTemplates.js'), out);
console.log('已同步 extension/lib/pagamoTemplates.js');

// 依年級改寫的標準：網站、後端、擴充套件共用同一份（src/lib/gradeLevels.json）。
const gradeJson = fs.readFileSync(path.join(root, 'src/lib/gradeLevels.json'), 'utf8');
JSON.parse(gradeJson);
fs.writeFileSync(path.join(root, 'functions/src/flows/grade-levels.json'), gradeJson);
fs.writeFileSync(path.join(root, 'extension/lib/gradeLevels.js'), `// 自動產生，請勿手動修改：由 tools/sync-extension.cjs 從 src/lib/gradeLevels.json 同步。
export const GRADE_LEVELS = ${gradeJson.trim()};
`);
console.log('已同步 functions/src/flows/grade-levels.json 與 extension/lib/gradeLevels.js');
