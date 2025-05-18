
// src/lib/generatePdf.ts
'use client';

import jsPDF from 'jspdf';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import type { Toast } from '@/hooks/use-toast'; // Assuming useToast exports its Toast type

const convertFileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const pirlsLevelLabels: Record<GeneratePirlsQuestionsOutput['questions'][0]['pirlsLevel'], string> = {
  'locate & retrieve': '訊息提取與檢索',
  'make straightforward inferences': '直接推論',
  'interpret & integrate': '詮釋與整合',
  'evaluate & critique': '評估與批判',
};

async function loadFont(doc: jsPDF, showToast: typeof Toast) {
  try {
    const fontUrl = '/fonts/NotoSansTC-Regular.ttf'; // User needs to place this
    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error(`字型檔案下載失敗: ${response.statusText} (請確認 public/fonts/NotoSansTC-Regular.ttf 存在)`);
    }
    const fontBuffer = await response.arrayBuffer();
    
    // Convert ArrayBuffer to Base64 string
    let binary = '';
    const bytes = new Uint8Array(fontBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const fontBase64 = btoa(binary);

    doc.addFileToVFS('NotoSansTC-Regular.ttf', fontBase64);
    doc.addFont('NotoSansTC-Regular.ttf', 'NotoSansTC', 'normal');
    doc.setFont('NotoSansTC', 'normal'); // Set font for the document explicitly to normal
  } catch (error: any) {
    console.error("載入字型時發生錯誤:", error);
    doc.setFont('helvetica', 'normal'); // Fallback font
    showToast({
      title: "字型載入警告",
      description: `中文字型載入失敗，PDF 中的中文可能無法正確顯示。錯誤：${error.message || '未知錯誤'}。請確認 NotoSansTC-Regular.ttf 已放置於 public/fonts/ 資料夾。`,
      variant: "destructive",
    });
  }
}

export async function exportPIRLStoPDF(
  imageFiles: File[],
  questionsOutput: GeneratePirlsQuestionsOutput,
  showToast: typeof Toast
) {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  await loadFont(doc, showToast); // Font is set to NotoSansTC normal here

  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;
  const margin = 15; // mm
  const contentWidth = pageWidth - 2 * margin;

  function checkPageBreak(neededHeight: number) {
    if (yPos + neededHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  }

  // Title
  doc.setFontSize(18);
  // doc.setFont('NotoSansTC', 'normal'); // Ensure normal style for title, though it should be default
  doc.text('PIRLS 閱讀素養題組', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Images Section Title
  checkPageBreak(10);
  doc.setFontSize(14);
  doc.setFont('NotoSansTC', 'normal'); // Changed from bold to normal
  doc.text('一、閱讀文本 (圖片內容)', margin, yPos);
  doc.setFont('NotoSansTC', 'normal'); // Ensure subsequent text is normal
  yPos += 8;

  if (imageFiles.length === 0) {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.text('未上傳任何圖片。', margin, yPos);
    yPos += 7;
  } else {
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      try {
        const dataUri = await convertFileToDataUri(file);
        const imgProps = doc.getImageProperties(dataUri);
        const aspectRatio = imgProps.width / imgProps.height;
        
        let imgWidthOnPage = contentWidth;
        let imgHeightOnPage = imgWidthOnPage / aspectRatio;

        const maxImgHeight = (pageHeight - 2 * margin) / 2; 
        if (imgHeightOnPage > maxImgHeight) {
          imgHeightOnPage = maxImgHeight;
          imgWidthOnPage = imgHeightOnPage * aspectRatio;
        }
        if (imgWidthOnPage > contentWidth) {
            imgWidthOnPage = contentWidth;
            imgHeightOnPage = imgWidthOnPage / aspectRatio;
        }

        checkPageBreak(imgHeightOnPage + 5); 
        doc.addImage(dataUri, imgProps.fileType.toUpperCase(), margin, yPos, imgWidthOnPage, imgHeightOnPage);
        yPos += imgHeightOnPage + 5;
      } catch (e: any) {
        console.error(`Error adding image ${file.name} to PDF:`, e);
        checkPageBreak(10);
        doc.setTextColor(255, 0, 0); 
        doc.setFontSize(10);
        doc.text(`無法載入圖片: ${file.name} (錯誤: ${e.message || '未知問題'})`, margin, yPos);
        doc.setTextColor(0, 0, 0); 
        yPos += 7;
      }
    }
  }
  yPos += 5; 

  // Questions Section Title
  checkPageBreak(12);
  doc.setFontSize(16);
  doc.setFont('NotoSansTC', 'normal'); // Changed from bold to normal
  doc.text('二、PIRLS 題組題目', margin, yPos);
  doc.setFont('NotoSansTC', 'normal'); // Ensure subsequent text is normal
  yPos += 10;

  const optionLabels = ['(A)', '(B)', '(C)', '(D)'];

  questionsOutput.questions.forEach((q, index) => {
    const questionNumber = index + 1;
    let questionBlockNeededHeight = 20; 
    const questionTextLines = doc.splitTextToSize(`${questionNumber}. ${q.question}`, contentWidth);
    questionBlockNeededHeight += questionTextLines.length * 5; 
    
    q.options.forEach(opt => {
        questionBlockNeededHeight += doc.splitTextToSize(opt, contentWidth - 10).length * 4.5; 
    });
    questionBlockNeededHeight += 15; 

    const explanationLinesCount = doc.splitTextToSize(q.explanation, contentWidth).length;
    questionBlockNeededHeight += explanationLinesCount * 4.5;

    checkPageBreak(questionBlockNeededHeight);

    // Question Text
    doc.setFontSize(12);
    doc.setFont('NotoSansTC', 'normal'); // Changed from bold to normal
    doc.text(questionTextLines, margin, yPos);
    yPos += questionTextLines.length * 5 + 2;

    // PIRLS Level
    doc.setFontSize(9);
    doc.setFont('NotoSansTC', 'normal');
    doc.setTextColor(100, 100, 100); 
    doc.text(`PIRLS 層次：${pirlsLevelLabels[q.pirlsLevel]}`, margin, yPos);
    doc.setTextColor(0, 0, 0); 
    yPos += 6;

    // Options
    doc.setFontSize(10);
    doc.setFont('NotoSansTC', 'normal'); // Ensure options are normal
    q.options.forEach((option, optIndex) => {
      const optionFullText = `${optionLabels[optIndex]} ${option}`;
      const optionTextLines = doc.splitTextToSize(optionFullText, contentWidth - 5); 
      checkPageBreak(optionTextLines.length * 4.5 + 1);
      doc.text(optionTextLines, margin + 5, yPos);
      yPos += optionTextLines.length * 4.5 + 1;
    });
    yPos += 3; 

    // Correct Answer
    doc.setFontSize(10);
    doc.setFont('NotoSansTC', 'normal'); // Changed from bold to normal
    const correctAnswerText = `正確答案：${optionLabels[q.correctAnswerIndex]}`;
    checkPageBreak(6);
    doc.text(correctAnswerText, margin, yPos);
    yPos += 6;
    
    // Explanation
    doc.setFont('NotoSansTC', 'normal');
    const explanationHeaderText = "答案說明：";
    checkPageBreak(4.5);
    doc.text(explanationHeaderText, margin, yPos);
    yPos += 4.5;
    
    const explanationTextLines = doc.splitTextToSize(q.explanation, contentWidth - 5); 
    checkPageBreak(explanationTextLines.length * 4.5 + 5);
    doc.text(explanationTextLines, margin + 5, yPos);
    yPos += explanationTextLines.length * 4.5 + 8; 
  });

  try {
    doc.save('PIRLS_QuestionCraft_題組.pdf');
    showToast({
      title: "成功下載",
      description: "PIRLS 題組 PDF 已成功下載。請檢查您的下載資料夾。",
      variant: "default",
      className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
    });
  } catch (e: any) {
     console.error("儲存 PDF 時發生錯誤:", e);
     showToast({
      title: "PDF 儲存失敗",
      description: `無法儲存 PDF 檔案: ${e.message || '未知錯誤'}`,
      variant: "destructive",
    });
  }
}

