
// src/lib/generatePdf.ts
'use client';

import jsPDF from 'jspdf';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import type { Toast } from '@/hooks/use-toast';

type PirlsQuestion = GeneratePirlsQuestionsOutput['questions'][0];

type ProgressCallback = (progress: number, message: string) => void;

interface PdfExportOptions {
  questionsOutput: GeneratePirlsQuestionsOutput;
  showToast: typeof Toast;
  updateProgressCallback: ProgressCallback;
  imageFiles?: File[];
  inputText?: string;
}

const convertFileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const pirlsLevelLabels: Record<PirlsQuestion['pirlsLevel'], string> = {
  'locate & retrieve': '訊息提取與檢索',
  'make straightforward inferences': '直接推論',
  'interpret & integrate': '詮釋與整合',
  'evaluate & critique': '評估與批判',
};

const pirlsLevelRgbColors: Record<PirlsQuestion['pirlsLevel'], [number, number, number]> = {
  'locate & retrieve': [29, 78, 216],    // Blue-700
  'make straightforward inferences': [4, 120, 87], // Green-700
  'interpret & integrate': [234, 179, 8],  // Yellow-500
  'evaluate & critique': [107, 33, 168], // Purple-700
};

const themeColors = {
  primary: [37, 99, 235], // Updated to reflect new primary HSL(217 90% 60%)
  accent: [163, 135, 217],
  textDefault: [0, 0, 0],
  textMuted: [100, 100, 100],
  borderDefault: [200, 200, 200],
};


async function loadAndRegisterFont(
  doc: jsPDF,
  fontFileName: string, 
  fontFamilyNameInPdf: string, 
  fontStyleInPdf: string, 
  showToast: typeof Toast
) {
  try {
    const fontUrl = `/fonts/${fontFileName}`;
    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error(`字型檔案 ${fontFileName} 下載失敗: ${response.statusText} (請確認 public/fonts/${fontFileName} 存在)`);
    }
    const fontBuffer = await response.arrayBuffer();

    let binary = '';
    const bytes = new Uint8Array(fontBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const fontBase64 = btoa(binary);

    doc.addFileToVFS(fontFileName, fontBase64);
    doc.addFont(fontFileName, fontFamilyNameInPdf, fontStyleInPdf);
  } catch (error: any) {
    console.error(`載入字型 ${fontFileName} 時發生錯誤:`, error);
    showToast({
      title: "字型載入警告",
      description: `字型 ${fontFileName} 載入失敗，PDF 中的部分文字可能無法正確顯示。錯誤：${error.message || '未知錯誤'}。請確認 ${fontFileName} 已放置於 public/fonts/ 資料夾。`,
      variant: "destructive",
    });
    return false;
  }
  return true;
}

async function loadAllFonts(doc: jsPDF, showToast: typeof Toast, updateProgress: ProgressCallback) {
  const fontBaseName = 'NotoSansTC';
  const fontsToLoad = [
    { fileName: 'NotoSansTC-Regular.ttf', style: 'normal' },
    { fileName: 'NotoSansTC-Bold.ttf', style: 'bold' },
    { fileName: 'NotoSansTC-Medium.ttf', style: 'medium' },
    { fileName: 'NotoSansTC-Thin.ttf', style: 'thin' },
    { fileName: 'NotoSansTC-ExtraBold.ttf', style: 'extrabold' },
    { fileName: 'NotoSansTC-Black.ttf', style: 'black' },
  ];

  let allCustomFontsLoadedSuccessfully = true;
  for (let i = 0; i < fontsToLoad.length; i++) {
    const font = fontsToLoad[i];
    updateProgress(5 + Math.round((i / fontsToLoad.length) * 10), `載入字型 ${font.fileName}...`);
    const success = await loadAndRegisterFont(doc, font.fileName, fontBaseName, font.style, showToast);
    if (!success) {
      allCustomFontsLoadedSuccessfully = false;
    }
  }

  if (allCustomFontsLoadedSuccessfully) {
    doc.setFont(fontBaseName, 'normal'); 
    updateProgress(15, "所有字型已載入");
  } else {
    doc.setFont('helvetica', 'normal'); 
    updateProgress(15, "部分字型載入失敗，使用預設字型");
    showToast({
        title: "部分字型載入失敗",
        description: "由於部分自訂字型未能成功載入，PDF 將嘗試使用預設字型，部分文字樣式可能不如預期。",
        variant: "destructive"
    });
  }
}

export async function exportPIRLStoPDF({
  questionsOutput,
  imageFiles = [],
  inputText,
  showToast,
  updateProgressCallback
}: PdfExportOptions) {
  updateProgressCallback(0, '開始準備 PDF...');
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  await loadAllFonts(doc, showToast, updateProgressCallback); // Passes callback

  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;
  const margin = 15; 
  const contentWidth = pageWidth - 2 * margin;
  const defaultLineWidth = 0.2;
  const lineHeight = 6; // Increased line height for better readability

  function checkPageBreak(neededHeight: number) {
    if (yPos + neededHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  }

  updateProgressCallback(15, '設定 PDF 標題...');
  doc.setFont('NotoSansTC', 'black');
  doc.setFontSize(20);
  doc.setTextColor(...themeColors.textDefault);
  doc.text('PIRLS 閱讀素養題組', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  updateProgressCallback(20, '準備閱讀文本區塊...');
  checkPageBreak(12);
  const readingSectionTitle = '一、閱讀文本';
  doc.setFont('NotoSansTC', 'bold');
  doc.setFontSize(16);
  doc.text(readingSectionTitle, margin, yPos);
  const readingSectionTitleWidth = doc.getTextWidth(readingSectionTitle);
  doc.setDrawColor(...themeColors.primary);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos + 1.5, margin + readingSectionTitleWidth, yPos + 1.5);
  doc.setDrawColor(...themeColors.borderDefault); 
  doc.setLineWidth(defaultLineWidth);
  yPos += 10;

  doc.setFont('NotoSansTC', 'normal');
  doc.setFontSize(10);
  
  if (inputText && inputText.trim().length > 0) {
    updateProgressCallback(25, '正在處理文本內容...');
    // **FIX:** Replace tab characters with spaces to prevent jsPDF layout issues.
    const sanitizedText = inputText.replace(/\t/g, '  ');
    const textLines = doc.splitTextToSize(sanitizedText, contentWidth);
    
    // **FIX:** Iterate and draw line by line, checking for page breaks each time.
    textLines.forEach((line: string) => {
        checkPageBreak(lineHeight);
        doc.text(line, margin, yPos);
        yPos += lineHeight;
    });

    yPos += 5; // Add some space after the text block
    updateProgressCallback(50, '文本內容已加入');
  } else if (imageFiles.length > 0) {
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      updateProgressCallback(20 + Math.round((i / imageFiles.length) * 30), `正在處理圖片 ${i + 1} / ${imageFiles.length}...`);
      try {
        const dataUri = await convertFileToDataUri(file);
        const imgProps = doc.getImageProperties(dataUri);
        const aspectRatio = imgProps.width / imgProps.height;
        
        let imgWidthOnPage = contentWidth;
        let imgHeightOnPage = imgWidthOnPage / aspectRatio;

        const maxImgHeight = (pageHeight - 2 * margin) / 2.5; 
        if (imgHeightOnPage > maxImgHeight) {
          imgHeightOnPage = maxImgHeight;
          imgWidthOnPage = imgHeightOnPage * aspectRatio;
        }
        if (imgWidthOnPage > contentWidth) {
            imgWidthOnPage = contentWidth;
            imgHeightOnPage = imgWidthOnPage / aspectRatio;
        }

        checkPageBreak(imgHeightOnPage + 7); 
        doc.addImage(dataUri, imgProps.fileType.toUpperCase(), margin, yPos, imgWidthOnPage, imgHeightOnPage);
        yPos += imgHeightOnPage + 7; 
      } catch (e: any) {
        console.error(`Error adding image ${file.name} to PDF:`, e);
        checkPageBreak(10);
        doc.setTextColor(255, 0, 0); 
        doc.setFontSize(10);
        doc.text(`無法載入圖片: ${file.name} (錯誤: ${e.message || '未知問題'})`, margin, yPos);
        doc.setTextColor(...themeColors.textDefault); 
        yPos += 7;
      }
    }
    updateProgressCallback(50, '所有圖片已加入 PDF');
  } else {
    checkPageBreak(10);
    doc.text('未提供閱讀文本。', margin, yPos);
    yPos += 7;
    updateProgressCallback(50, '文本區塊完成 (無內容)');
  }
  yPos += 8; 

  updateProgressCallback(55, '準備題目區塊...');
  checkPageBreak(14);
  const questionsSectionTitle = '二、PIRLS 題組題目';
  doc.setFont('NotoSansTC', 'bold');
  doc.setFontSize(16);
  doc.text(questionsSectionTitle, margin, yPos);
  const questionsSectionTitleWidth = doc.getTextWidth(questionsSectionTitle);
  doc.setDrawColor(...themeColors.primary);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos + 1.5, margin + questionsSectionTitleWidth, yPos + 1.5);
  doc.setDrawColor(...themeColors.borderDefault);
  doc.setLineWidth(defaultLineWidth);
  yPos += 12;

  const optionLabels = ['(A)', '(B)', '(C)', '(D)'];

  questionsOutput.questions.forEach((q, index) => {
    updateProgressCallback(55 + Math.round(((index + 1) / questionsOutput.questions.length) * 40), `正在處理題目 ${index + 1} / ${questionsOutput.questions.length}...`);
    let questionBlockNeededHeight = 25; 
    
    doc.setFont('NotoSansTC', 'medium'); 
    doc.setFontSize(12);
    questionBlockNeededHeight += doc.splitTextToSize(q.question, contentWidth - doc.getTextWidth(`${index + 1}. `)).length * 6;
    doc.setFont('NotoSansTC', 'normal');
    doc.setFontSize(10);
    q.options.forEach(opt => { questionBlockNeededHeight += doc.splitTextToSize(opt, contentWidth - 10).length * 5; });
    questionBlockNeededHeight += 18; 
    questionBlockNeededHeight += doc.splitTextToSize(q.explanation, contentWidth).length * 5;

    checkPageBreak(questionBlockNeededHeight);
    
    const questionStartY = yPos; 

    const questionNumberText = `${index + 1}. `;
    doc.setFontSize(12);
    doc.setFont('NotoSansTC', 'bold');
    const questionNumberWidth = doc.getTextWidth(questionNumberText);
    doc.text(questionNumberText, margin, yPos);
    
    doc.setFont('NotoSansTC', 'medium');
    const questionTextLines = doc.splitTextToSize(q.question, contentWidth - questionNumberWidth);
    doc.text(questionTextLines, margin + questionNumberWidth, yPos);
    yPos += questionTextLines.length * 6 + 2;

    doc.setFont('NotoSansTC', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...themeColors.textMuted); 
    doc.text(`PIRLS 層次：${pirlsLevelLabels[q.pirlsLevel]}`, margin, yPos);
    doc.setTextColor(...themeColors.textDefault); 
    yPos += 7;

    doc.setFont('NotoSansTC', 'normal');
    doc.setFontSize(10);
    q.options.forEach((option, optIndex) => {
      const optionFullText = `${optionLabels[optIndex]} ${option}`;
      const optionTextLines = doc.splitTextToSize(optionFullText, contentWidth - 8); 
      checkPageBreak(optionTextLines.length * 5 + 1.5); 
      doc.text(optionTextLines, margin + 5, yPos);
      yPos += optionTextLines.length * 5 + 1.5;
    });
    yPos += 4; 

    doc.setFont('NotoSansTC', 'bold');
    doc.setFontSize(10);
    const correctAnswerText = `正確答案：${optionLabels[q.correctAnswerIndex]}`;
    checkPageBreak(7);
    doc.text(correctAnswerText, margin, yPos);
    yPos += 7;
    
    doc.setFont('NotoSansTC', 'bold');
    doc.setFontSize(10);
    const explanationHeaderText = "答案說明：";
    checkPageBreak(5);
    doc.text(explanationHeaderText, margin, yPos);
    yPos += 5;
    
    doc.setFont('NotoSansTC', 'normal');
    doc.setFontSize(10);
    const explanationTextLines = doc.splitTextToSize(q.explanation, contentWidth - 8); 
    checkPageBreak(explanationTextLines.length * 5 + 8); 
    doc.text(explanationTextLines, margin + 5, yPos);
    
    const questionEndY = yPos + explanationTextLines.length * 5; 
    
    const borderColorRgb = pirlsLevelRgbColors[q.pirlsLevel];
    doc.setDrawColor(borderColorRgb[0], borderColorRgb[1], borderColorRgb[2]);
    doc.setLineWidth(1.5); 
    doc.line(margin - 3, questionStartY - 2, margin - 3, questionEndY - 1); 
    doc.setDrawColor(...themeColors.borderDefault); 
    doc.setLineWidth(defaultLineWidth);

    yPos += explanationTextLines.length * 5 + 10; 
  });

  updateProgressCallback(98, '準備儲存 PDF 檔案...');
  try {
    doc.save('PIRLS_QuestionCraft_題組.pdf');
    updateProgressCallback(100, 'PDF 檔案已開始下載！');
    showToast({
      title: "成功下載",
      description: "PIRLS 題組 PDF 已成功下載。請檢查您的下載資料夾。",
      variant: "default",
      className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
    });
  } catch (e: any) {
     console.error("儲存 PDF 時發生錯誤:", e);
     updateProgressCallback(100, 'PDF 檔案儲存失敗。');
     showToast({
      title: "PDF 儲存失敗",
      description: `無法儲存 PDF 檔案: ${e.message || '未知錯誤'}`,
      variant: "destructive",
    });
  }
}
