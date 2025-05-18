
// src/lib/generatePdf.ts
'use client';

import jsPDF from 'jspdf';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import type { Toast } from '@/hooks/use-toast';

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

// Helper function to load and register a single font
async function loadAndRegisterFont(
  doc: jsPDF,
  fontFileName: string, // e.g., 'NotoSansTC-Regular.ttf'
  fontFamilyNameInPdf: string, // e.g., 'NotoSansTC'
  fontStyleInPdf: string, // e.g., 'normal', 'bold', 'medium'
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
    // console.log(`Font ${fontFileName} as ${fontFamilyNameInPdf} ${fontStyleInPdf} loaded and registered.`);
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

// Main function to load all fonts
async function loadAllFonts(doc: jsPDF, showToast: typeof Toast) {
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
  for (const font of fontsToLoad) {
    const success = await loadAndRegisterFont(doc, font.fileName, fontBaseName, font.style, showToast);
    if (!success) {
      allCustomFontsLoadedSuccessfully = false;
    }
  }

  if (allCustomFontsLoadedSuccessfully) {
    doc.setFont(fontBaseName, 'normal'); // Set default font for the document
  } else {
    // If any custom font fails, jsPDF will use its built-in 'helvetica' or other fallbacks
    // for the specific setFont calls if 'NotoSansTC' with a specific style isn't found.
    // We'll set a general fallback here, but individual setFont calls might still attempt NotoSansTC.
    doc.setFont('helvetica', 'normal'); 
    showToast({
        title: "部分字型載入失敗",
        description: "由於部分自訂字型未能成功載入，PDF 將嘗試使用預設字型，部分文字樣式可能不如預期。",
        variant: "destructive"
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

  await loadAllFonts(doc, showToast);

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
  doc.setFont('NotoSansTC', 'black');
  doc.setFontSize(20);
  doc.text('PIRLS 閱讀素養題組', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15; // Increased spacing after main title

  // Images Section Title
  checkPageBreak(12);
  doc.setFont('NotoSansTC', 'bold');
  doc.setFontSize(16);
  doc.text('一、閱讀文本 (圖片內容)', margin, yPos);
  yPos += 10; // Increased spacing

  doc.setFont('NotoSansTC', 'normal'); // Reset to normal for image placeholder or content
  doc.setFontSize(10);

  if (imageFiles.length === 0) {
    checkPageBreak(10);
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

        const maxImgHeight = (pageHeight - 2 * margin) / 2.5; // Adjusted max height for better spacing
        if (imgHeightOnPage > maxImgHeight) {
          imgHeightOnPage = maxImgHeight;
          imgWidthOnPage = imgHeightOnPage * aspectRatio;
        }
        if (imgWidthOnPage > contentWidth) {
            imgWidthOnPage = contentWidth;
            imgHeightOnPage = imgWidthOnPage / aspectRatio;
        }

        checkPageBreak(imgHeightOnPage + 7); // Increased spacing
        doc.addImage(dataUri, imgProps.fileType.toUpperCase(), margin, yPos, imgWidthOnPage, imgHeightOnPage);
        yPos += imgHeightOnPage + 7; // Increased spacing
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
  yPos += 8; 

  // Questions Section Title
  checkPageBreak(14); // Increased spacing
  doc.setFont('NotoSansTC', 'bold');
  doc.setFontSize(16);
  doc.text('二、PIRLS 題組題目', margin, yPos);
  yPos += 12; // Increased spacing

  const optionLabels = ['(A)', '(B)', '(C)', '(D)'];

  questionsOutput.questions.forEach((q, index) => {
    const questionNumberText = `${index + 1}. `;
    const fullQuestionText = q.question;
    
    // Estimate height roughly (actual height depends on line splitting)
    let questionBlockNeededHeight = 25; // Initial estimate for margins and static parts
    
    doc.setFont('NotoSansTC', 'bold'); // For question number
    doc.setFontSize(12);
    const questionNumberWidth = doc.getTextWidth(questionNumberText);
    
    doc.setFont('NotoSansTC', 'medium'); // For question text
    const questionTextLines = doc.splitTextToSize(fullQuestionText, contentWidth - questionNumberWidth);
    questionBlockNeededHeight += questionTextLines.length * 6; // line height approx 6 for size 12

    doc.setFont('NotoSansTC', 'normal');
    doc.setFontSize(10);
    q.options.forEach(opt => {
        questionBlockNeededHeight += doc.splitTextToSize(opt, contentWidth - 10).length * 5; 
    });
    questionBlockNeededHeight += 18; // For answer, explanation header

    const explanationLinesCount = doc.splitTextToSize(q.explanation, contentWidth).length;
    questionBlockNeededHeight += explanationLinesCount * 5;

    checkPageBreak(questionBlockNeededHeight);

    // Question Number (Bold) and Text (Medium)
    doc.setFontSize(12);
    doc.setFont('NotoSansTC', 'bold');
    doc.text(questionNumberText, margin, yPos, {renderingMode: 'fillThenStroke'}); // Ensure bold renders if possible
    
    doc.setFont('NotoSansTC', 'medium');
    doc.text(questionTextLines, margin + questionNumberWidth, yPos);
    yPos += questionTextLines.length * 6 + 2; // Line height approx 6 for size 12

    // PIRLS Level
    doc.setFont('NotoSansTC', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100); 
    doc.text(`PIRLS 層次：${pirlsLevelLabels[q.pirlsLevel]}`, margin, yPos);
    doc.setTextColor(0, 0, 0); 
    yPos += 7; // Increased spacing

    // Options
    doc.setFont('NotoSansTC', 'normal');
    doc.setFontSize(10);
    q.options.forEach((option, optIndex) => {
      // Option Label (A,B,C,D) - kept normal for simplicity with text flow
      const optionFullText = `${optionLabels[optIndex]} ${option}`;
      const optionTextLines = doc.splitTextToSize(optionFullText, contentWidth - 8); // Indent slightly
      checkPageBreak(optionTextLines.length * 5 + 1); // line height approx 5 for size 10
      doc.text(optionTextLines, margin + 5, yPos);
      yPos += optionTextLines.length * 5 + 1.5; // Spacing between options
    });
    yPos += 4; 

    // Correct Answer
    doc.setFont('NotoSansTC', 'bold');
    doc.setFontSize(10);
    const correctAnswerText = `正確答案：${optionLabels[q.correctAnswerIndex]}`;
    checkPageBreak(7);
    doc.text(correctAnswerText, margin, yPos);
    yPos += 7;
    
    // Explanation Header
    doc.setFont('NotoSansTC', 'bold');
    doc.setFontSize(10);
    const explanationHeaderText = "答案說明：";
    checkPageBreak(5);
    doc.text(explanationHeaderText, margin, yPos);
    yPos += 5;
    
    // Explanation Text
    doc.setFont('NotoSansTC', 'normal');
    doc.setFontSize(10);
    const explanationTextLines = doc.splitTextToSize(q.explanation, contentWidth - 8); // Indent slightly
    checkPageBreak(explanationTextLines.length * 5 + 8); // line height approx 5
    doc.text(explanationTextLines, margin + 5, yPos);
    yPos += explanationTextLines.length * 5 + 10; // Increased spacing after each question block
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

