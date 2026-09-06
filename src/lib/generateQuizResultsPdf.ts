// src/lib/generateQuizResultsPdf.ts
'use client';

import type { jsPDF } from 'jspdf';
import type { GeneratePirlsQuestionsOutput } from '@/lib/api';
import type { Toast } from '@/hooks/use-toast';

type PirlsQuestionOriginal = GeneratePirlsQuestionsOutput['questions'][0];

export interface StudentInfo { 
  class: string;
  seatNumber: string;
  name: string;
}

interface QuizResultItem {
  questionText: string;
  options: string[];
  userAnswerIndex: number | null;
  correctAnswerIndex: number;
  isCorrect: boolean;
  explanation: string;
  pirlsLevel: PirlsQuestionOriginal['pirlsLevel'];
}

type ProgressCallback = (progress: number, message: string) => void;

const pirlsLevelLabels: Record<PirlsQuestionOriginal['pirlsLevel'], string> = {
  'locate & retrieve': '訊息提取與檢索',
  'make straightforward inferences': '直接推論',
  'interpret & integrate': '詮釋與整合',
  'evaluate & critique': '評估與批判',
};

const pirlsLevelRgbColors: Record<PirlsQuestionOriginal['pirlsLevel'], [number, number, number]> = {
  'locate & retrieve': [59, 130, 246],  // blue-500
  'make straightforward inferences': [34, 197, 94], // green-500
  'interpret & integrate': [234, 179, 8],   // yellow-500 (amber-500)
  'evaluate & critique': [168, 85, 247],  // purple-500
};

const themeColors: Record<string, [number, number, number]> = {
  primary: [37, 99, 235],
  textDefault: [0, 0, 0],
  textMuted: [100, 100, 100],
  textCorrect: [22, 163, 74], // green-600
  textIncorrect: [220, 38, 38], // red-600
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
    const fontUrl = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/fonts/${fontFileName}`;
    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error(`字型檔案 ${fontFileName} 下載失敗: ${response.statusText}`);
    }
    const fontBuffer = await response.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(fontBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    doc.addFileToVFS(fontFileName, btoa(binary));
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

async function loadAllRequiredFonts(doc: jsPDF, showToast: typeof Toast, updateProgress: ProgressCallback) {
  const fontBaseName = 'NotoSansTC';
  const fontsToLoad = [
    { fileName: 'NotoSansTC-Regular.ttf', style: 'normal' },
    { fileName: 'NotoSansTC-Bold.ttf', style: 'bold' },
    { fileName: 'NotoSansTC-Medium.ttf', style: 'medium' },
    { fileName: 'NotoSansTC-Black.ttf', style: 'black' },
  ];
  let allFontsLoaded = true;
  const baseProgress = 0; 
  const progressPerFont = 5 / fontsToLoad.length; // Allocate 5% for font loading

  for (let i = 0; i < fontsToLoad.length; i++) {
    const font = fontsToLoad[i];
    updateProgress(baseProgress + Math.round(((i + 1) / fontsToLoad.length) * 5), `載入字型 ${font.fileName}...`);
    if (!(await loadAndRegisterFont(doc, font.fileName, fontBaseName, font.style, showToast))) {
      allFontsLoaded = false;
    }
  }
  doc.setFont(allFontsLoaded ? fontBaseName : 'helvetica', 'normal');
  updateProgress(5, allFontsLoaded ? "所有字型已載入" : "部分字型載入失敗，使用預設字型");
}

export async function exportQuizResultsToPDF(
  quizResults: QuizResultItem[],
  imageURIs: string[],
  inputText: string | undefined,
  studentInfo: StudentInfo | undefined,
  showToast: typeof Toast,
  updateProgressCallback: ProgressCallback
) {
  updateProgressCallback(0, '開始準備測驗結果 PDF...');
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  await loadAllRequiredFonts(doc, showToast, updateProgressCallback); // Progress from 0-5%

  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 15;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  const optionLabels = ['A', 'B', 'C', 'D'];
  const defaultLineWidth = 0.2;

  function checkPageBreak(neededHeight: number, addFooterIfNeeded = true) {
    if (yPos + neededHeight > pageHeight - (addFooterIfNeeded ? 15 : margin)) {
      if (addFooterIfNeeded) addFooter(doc, pageHeight);
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  }

  function addFooter(pdfDoc: jsPDF, currentPageHeight: number) {
    const pageNum = pdfDoc.getNumberOfPages();
    pdfDoc.setFont('NotoSansTC', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.setTextColor(...themeColors.textMuted);
    pdfDoc.text(`第 ${pageNum} 頁`, pageWidth - margin, currentPageHeight - 7, { align: 'right' });
  }

  updateProgressCallback(5, '設定 PDF 標題與日期...');
  doc.setFont('NotoSansTC', 'black');
  doc.setFontSize(20);
  doc.setTextColor(...themeColors.textDefault);
  doc.text('PIRLS 線上測驗結果', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFont('NotoSansTC', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...themeColors.textMuted);
  doc.text(`測驗日期：${new Date().toLocaleDateString('zh-TW')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 7;

  if (studentInfo) {
    updateProgressCallback(7, '加入學生資訊...');
    doc.setFont('NotoSansTC', 'medium');
    doc.setFontSize(12);
    checkPageBreak(25);
    let studentInfoY = yPos;
    doc.text(`班級：${studentInfo.class}`, margin, studentInfoY);
    studentInfoY += 7;
    doc.text(`座號：${studentInfo.seatNumber}`, margin, studentInfoY);
    studentInfoY += 7;
    doc.text(`姓名：${studentInfo.name}`, margin, studentInfoY);
    yPos = studentInfoY + 7;
  }
  doc.setDrawColor(...themeColors.borderDefault);
  doc.line(margin, yPos, pageWidth - margin, yPos); // Separator
  yPos += 8;

  // --- Add Reading Content Section ---
  updateProgressCallback(10, '準備閱讀文本區塊...');
  checkPageBreak(12);
  const contentSectionTitle = '一、閱讀文本';
  doc.setFont('NotoSansTC', 'bold');
  doc.setFontSize(16);
  doc.text(contentSectionTitle, margin, yPos);
  const contentSectionTitleWidth = doc.getTextWidth(contentSectionTitle);
  doc.setDrawColor(...themeColors.primary);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos + 1.5, margin + contentSectionTitleWidth, yPos + 1.5);
  doc.setDrawColor(...themeColors.borderDefault);
  doc.setLineWidth(defaultLineWidth);
  yPos += 10;

  doc.setFont('NotoSansTC', 'normal');
  doc.setFontSize(10);

  const hasImages = imageURIs && imageURIs.length > 0;
  const hasText = inputText && inputText.trim().length > 0;

  if (hasText) {
    updateProgressCallback(15, '正在處理文字內容...');
    const textLines = doc.splitTextToSize(inputText, contentWidth);
    checkPageBreak(textLines.length * 5);
    doc.text(textLines, margin, yPos);
    yPos += textLines.length * 5 + 5;
    updateProgressCallback(30, '文字內容已加入');
  } else if (hasImages) {
    const imageProgressStart = 10;
    const imageProgressTotal = 20; // Allocate 20% for image processing
    for (let i = 0; i < imageURIs.length; i++) {
      const dataUri = imageURIs[i];
      updateProgressCallback(
        imageProgressStart + Math.round(((i + 1) / imageURIs.length) * imageProgressTotal),
        `正在處理圖片 ${i + 1} / ${imageURIs.length}...`
      );
      try {
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
        checkPageBreak(imgHeightOnPage + 7);
        doc.addImage(dataUri, imgProps.fileType.toUpperCase(), margin, yPos, imgWidthOnPage, imgHeightOnPage);
        yPos += imgHeightOnPage + 7;
      } catch (e: any) {
        // ... error handling
      }
    }
    updateProgressCallback(30, '所有圖片已加入 PDF');
  } else {
    checkPageBreak(10);
    doc.text('未提供相關閱讀文本。', margin, yPos);
    yPos += 7;
    updateProgressCallback(30, '文本區塊完成 (無內容)');
  }
  yPos += 3;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;
  // --- End Reading Content Section ---

  updateProgressCallback(30, '計算總體表現...');
  const totalQuestions = quizResults.length;
  const totalCorrect = quizResults.filter(r => r.isCorrect).length;
  const overallScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  checkPageBreak(25);
  doc.setFont('NotoSansTC', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...themeColors.textDefault);
  doc.text('二、總體表現', margin, yPos);
  yPos += 8;

  doc.setFont('NotoSansTC', 'medium');
  doc.setFontSize(12);
  doc.text(`答對題數：${totalCorrect} / ${totalQuestions} 題`, margin, yPos);
  yPos += 7;
  doc.text(`整體正確率：${overallScore}%`, margin, yPos);
  yPos += 10;
  doc.line(margin, yPos, pageWidth - margin, yPos); // Separator
  yPos += 8;

  updateProgressCallback(35, '計算各PIRLS層次得分...');
  checkPageBreak(10 + Object.keys(pirlsLevelLabels).length * 7);
  doc.setFont('NotoSansTC', 'bold');
  doc.setFontSize(16);
  doc.text('三、各PIRLS層次得分', margin, yPos);
  yPos += 8;

  doc.setFont('NotoSansTC', 'medium');
  const pirlsScores: Record<string, { correct: number, total: number, label: string }> = {};
  (Object.keys(pirlsLevelLabels) as Array<PirlsQuestionOriginal['pirlsLevel']>).forEach(levelKey => {
    pirlsScores[levelKey] = { correct: 0, total: 0, label: pirlsLevelLabels[levelKey] };
  });
  quizResults.forEach(result => {
    if (pirlsScores[result.pirlsLevel]) {
      pirlsScores[result.pirlsLevel].total++;
      if (result.isCorrect) pirlsScores[result.pirlsLevel].correct++;
    }
  });

  Object.entries(pirlsScores).forEach(([levelKey, score]) => {
    if (score.total > 0) {
      checkPageBreak(7);
      doc.setFontSize(12);
      const levelColor = pirlsLevelRgbColors[levelKey as PirlsQuestionOriginal['pirlsLevel']] || themeColors.textDefault;
      doc.setTextColor(...levelColor);
      doc.text(`${score.label}：`, margin, yPos);
      doc.setTextColor(...themeColors.textDefault);
      doc.text(`${score.correct} / ${score.total} 題 (${Math.round(score.total > 0 ? (score.correct / score.total) * 100 : 0)}%)`, margin + 45, yPos);
      yPos += 7;
    }
  });
  yPos += 3;
  doc.line(margin, yPos, pageWidth - margin, yPos); // Separator
  yPos += 8;

  updateProgressCallback(40, '準備題目詳解...');
  checkPageBreak(15);
  doc.setFont('NotoSansTC', 'bold');
  doc.setFontSize(16);
  doc.text('四、題目詳解', margin, yPos);
  yPos += 10;

  const questionProgressStart = 40;
  const questionProgressTotal = 58;

  quizResults.forEach((result, index) => {
    const progressPercentage = questionProgressStart + Math.round(((index + 1) / totalQuestions) * questionProgressTotal);
    updateProgressCallback(progressPercentage, `處理題目 ${index + 1} / ${totalQuestions} 的詳解...`);

    let neededHeightEst = 10;
    doc.setFont('NotoSansTC', 'medium');
    doc.setFontSize(12);
    neededHeightEst += doc.splitTextToSize(result.questionText, contentWidth - 10).length * 5;
    neededHeightEst += 5;
    doc.setFont('NotoSansTC', 'normal');
    doc.setFontSize(10);
    const userAnswerDisplay = result.userAnswerIndex !== null ? `${optionLabels[result.userAnswerIndex]}. ${result.options[result.userAnswerIndex]}` : '未作答';
    neededHeightEst += doc.splitTextToSize(`您的答案：${userAnswerDisplay} (${result.isCorrect ? '正確' : '錯誤'})`, contentWidth).length * 4;
    if (!result.isCorrect) {
        neededHeightEst += doc.splitTextToSize(result.explanation, contentWidth - 5).length * 4;
    }
    neededHeightEst += 10;

    checkPageBreak(neededHeightEst);

    doc.setFont('NotoSansTC', 'bold');
    doc.setFontSize(12);
    const questionNumberText = `題目 ${index + 1}: `;
    const qNumWidth = doc.getTextWidth(questionNumberText);
    doc.text(questionNumberText, margin, yPos);

    doc.setFont('NotoSansTC', 'medium');
    const questionTextLines = doc.splitTextToSize(result.questionText, contentWidth - qNumWidth);
    doc.text(questionTextLines, margin + qNumWidth, yPos);
    yPos += questionTextLines.length * 5 + 2;

    doc.setFont('NotoSansTC', 'normal');
    doc.setFontSize(9);
    const levelDetailText = `PIRLS 層次：${pirlsLevelLabels[result.pirlsLevel]}`;
    const levelColorText = pirlsLevelRgbColors[result.pirlsLevel] || themeColors.textMuted;
    doc.setTextColor(...levelColorText);
    doc.text(levelDetailText, margin, yPos);
    doc.setTextColor(...themeColors.textDefault);
    yPos += 6;

    doc.setFontSize(10);
    const userAnswerFullText = `您的答案：${result.userAnswerIndex !== null ? optionLabels[result.userAnswerIndex] + '. ' + result.options[result.userAnswerIndex] : '未作答'} (${result.isCorrect ? '正確' : '錯誤'})`;
    if(result.isCorrect) {
        doc.setTextColor(...themeColors.textCorrect);
    } else {
        doc.setTextColor(...themeColors.textIncorrect);
    }
    const userAnswerLines = doc.splitTextToSize(userAnswerFullText, contentWidth);
    doc.text(userAnswerLines, margin, yPos);
    doc.setTextColor(...themeColors.textDefault);
    yPos += userAnswerLines.length * 4 + 1;


    if (!result.isCorrect) {
      doc.setFont('NotoSansTC', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...themeColors.textMuted);
      const explanationHeader = '解題引導：';
      doc.text(explanationHeader, margin, yPos);
      const explanationLines = doc.splitTextToSize(result.explanation, contentWidth - doc.getTextWidth(explanationHeader) -2);
      doc.text(explanationLines, margin + doc.getTextWidth(explanationHeader) + 2 , yPos);
      yPos += explanationLines.length * 4 + 1;
      doc.setTextColor(...themeColors.textDefault);
    }
    yPos += 5;
    if (index < totalQuestions - 1) {
      checkPageBreak(2);
      doc.setDrawColor(...themeColors.borderDefault);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
    }
  });

  addFooter(doc, pageHeight);

  updateProgressCallback(98, '準備儲存測驗結果 PDF...');
  try {
    const fileName = studentInfo ? `PIRLS_測驗結果_${studentInfo.class}_${studentInfo.seatNumber}_${studentInfo.name}.pdf` : 'PIRLS_測驗結果.pdf';
    doc.save(fileName);
    updateProgressCallback(100, '測驗結果 PDF 已開始下載！');
    showToast({
      title: "成功下載結果",
      description: "PIRLS 測驗結果 PDF 已成功下載。",
      variant: "default",
      className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
    });
  } catch (e: any) {
    console.error("儲存測驗結果 PDF 時發生錯誤:", e);
    updateProgressCallback(100, '測驗結果 PDF 儲存失敗。');
    showToast({
      title: "PDF 儲存失敗",
      description: `無法儲存測驗結果 PDF: ${e.message || '未知錯誤'}`,
      variant: "destructive",
    });
  }
}
