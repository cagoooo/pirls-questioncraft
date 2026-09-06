'use client';

import { loadAndRegisterFont, convertFileToDataUri } from './generatePdf';
import type { Toast } from '@/hooks/use-toast';

// Deliberately accepts reading material only: no question/answer object crosses this boundary.
export interface ReadingSource { text: string; images: File[] }
export async function downloadReadingPdf(source: ReadingSource, toast: typeof Toast) {
  if (!source.text.trim() && !source.images.length) throw new Error('沒有可下載的閱讀素材。');
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF();
  if (!await loadAndRegisterFont(doc, 'NotoSansTC-Regular.ttf', 'NotoSansTC', 'normal', toast)) throw new Error('中文字型載入失敗，請稍後重試。');
  doc.setFont('NotoSansTC', 'normal');
  doc.setFontSize(18);
  doc.text('PIRLS 學生閱讀素材', 15, 22);
  doc.setFontSize(12);
  let y = 36;
  if (source.images.length) {
    // Original images carry diagrams/layout that OCR cannot reproduce.
    for (const file of source.images) {
      const uri = await convertFileToDataUri(file);
      const props = doc.getImageProperties(uri);
      const scale = Math.min(180 / props.width, 240 / props.height);
      const w = props.width * scale, h = props.height * scale;
      if (y + h > 282) { doc.addPage(); y = 15; }
      doc.addImage(uri, props.fileType.toUpperCase(), 15, y, w, h);
      y += h + 8;
    }
  } else {
    for (const line of doc.splitTextToSize(source.text.replace(/\t/g, '  '), 180)) {
      if (y > 280) { doc.addPage(); y = 18; }
      doc.text(line, 15, y);
      y += 7;
    }
  }
  doc.save('PIRLS_學生閱讀素材_不含解答.pdf');
}
