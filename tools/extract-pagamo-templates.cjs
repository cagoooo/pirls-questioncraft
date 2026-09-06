// Run after replacing the official XLSX files; regression tests verify the result.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const XLSX = require('xlsx');
const root = path.resolve(__dirname, '..');
const templates = {};
for (const kind of ['choice', 'group']) {
  const file = path.join(root, 'public/export-templates', `pagamo-${kind}.xlsx`);
  const book = XLSX.readFile(file);
  const sheet = book.Sheets[book.SheetNames[0]];
  templates[kind] = {
    sheetName: book.SheetNames[0],
    headers: XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: true }).slice(0, 10),
    merges: (sheet['!merges'] || []).filter(m => m.e.r < 10),
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  };
}
fs.writeFileSync(path.join(root, 'src/lib/pagamoTemplates.json'), JSON.stringify(templates, null, 2) + '\n');
