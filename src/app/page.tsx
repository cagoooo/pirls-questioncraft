"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Accordion } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { PirlsLogo } from '@/components/PirlsLogo';
import { FileUpload } from '@/components/FileUpload';
import { QuestionCard } from '@/components/QuestionCard';
import { QuizView } from '@/components/QuizView';
import { TurnstileGate } from '@/components/TurnstileGate';
import { ShareDialog } from '@/components/ShareDialog';
import { HelpDialog } from '@/components/HelpDialog';
import { NeoCard, PillBtn, Star, Squiggle, Spark, PIRLS_LEVEL_META, type PirlsLevel } from '@/components/Neo';
import {
  generatePirlsQuestions,
  generatePirlsQuestionsFromText,
  createSharedQuiz,
} from '@/lib/api';
import type { GeneratePirlsQuestionsOutput } from '@/lib/api';
import { exportPIRLStoPDF } from '@/lib/generatePdf';
import { PlatformExportDialog } from '@/components/PlatformExportDialog';
import type { ReadingSource } from '@/lib/generateReadingPdf';
import { exportPIRLStoExcel } from '@/lib/generateExcel';
import { exportPIRLStoPaGamO } from '@/lib/generatePaGamOExcel';
import { exportPIRLStoPaGamOQuizGroup, type PaGamOQuizGroupData } from '@/lib/generatePaGamOQuizGroupExcel';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Loader2, MessageSquareHeart, FileText, Image as ImageIcon, Sparkles, Star as StarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProgressCallback = (progress: number, message: string) => void;
type InputMode = 'image' | 'text';

/** 模擬 AI 出題進度條 — 邏輯與原本相同 */
function simulateProgress(
  fromPercent: number,
  updateProgress: (progress: number, message: string) => void,
  isImageMode: boolean
): () => void {
  const stages = isImageMode
    ? [
        { until: 50, msg: '🔍 AI 正在辨識圖片中的文字...' },
        { until: 62, msg: '📝 AI 正在校正錯字、重組成完整文章...' },
        { until: 72, msg: '💭 AI 正在理解文章主旨與脈絡...' },
        { until: 82, msg: '🎯 AI 正在設計 PIRLS 四層次題目...' },
        { until: 90, msg: '✏️ AI 正在撰寫干擾選項與解題引導...' },
        { until: 95, msg: '⚖️ AI 正在校對題目層次平衡...' },
        { until: 96, msg: '✨ 即將完成，最後潤飾中...' },
      ]
    : [
        { until: 55, msg: '💭 AI 正在閱讀並理解文章...' },
        { until: 68, msg: '🧠 AI 正在分析 PIRLS 四層次架構...' },
        { until: 78, msg: '🎯 AI 正在設計選擇題與選項...' },
        { until: 86, msg: '✏️ AI 正在撰寫干擾選項與解題引導...' },
        { until: 92, msg: '⚖️ AI 正在校對題目層次平衡...' },
        { until: 95, msg: '✨ 即將完成，最後潤飾中...' },
        { until: 96, msg: '✨ 即將完成，最後潤飾中...' },
      ];

  const totalDurationMs = 22000;
  const start = Date.now();
  let lastShown = fromPercent;

  const id = setInterval(() => {
    const elapsed = Date.now() - start;
    const ratio = Math.min(elapsed / totalDurationMs, 1);
    const eased = 1 - Math.pow(1 - ratio, 2.2);
    const progress = Math.min(fromPercent + (96 - fromPercent) * eased, 96);
    if (progress > lastShown) {
      lastShown = progress;
      const stage = stages.find((s) => progress < s.until) ?? stages[stages.length - 1];
      updateProgress(progress, stage.msg);
    }
  }, 200);

  return () => clearInterval(id);
}

const resizeImage = (file: File, maxSize: number = 1600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) {
        return reject(new Error("FileReader did not return a result."));
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height *= maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Failed to get canvas 2D context.'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = (err) => reject(err);
      img.src = e.target.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export default function PIRLSQuestionCraftPage() {
  const [inputMode, setInputMode] = useState<InputMode>('image');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [inputText, setInputText] = useState('');
  const [questionMode, setQuestionMode] = useState<'8-questions' | '10-questions'>('8-questions');
  const [languageMode, setLanguageMode] = useState<'zh-TW' | 'en'>('zh-TW');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [isGeneratingPaGamO, setIsGeneratingPaGamO] = useState(false);
  const [isGeneratingPaGamOQuizGroup, setIsGeneratingPaGamOQuizGroup] = useState(false);
  const [isGeneratingQuizResultsPdf, setIsGeneratingQuizResultsPdf] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedQuestionsOutput, setGeneratedQuestionsOutput] = useState<GeneratePirlsQuestionsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readingSource, setReadingSource] = useState<ReadingSource>({ text: '', images: [] });

  const [fileGenerationProgress, setFileGenerationProgress] = useState(0);
  const [fileGenerationMessage, setFileGenerationMessage] = useState('');
  const [isQuizActive, setIsQuizActive] = useState(false);

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isSharingQuiz, setIsSharingQuiz] = useState(false);
  const [currentShareLink, setCurrentShareLink] = useState('');

  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  const { toast } = useToast();
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const loadingSectionRef = useRef<HTMLDivElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const fileProgressSectionRef = useRef<HTMLDivElement>(null);
  const textInputAreaRef = useRef<HTMLDivElement>(null);
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  const [preparedPaGamOData, setPreparedPaGamOData] = useState<PaGamOQuizGroupData | null>(null);

  useEffect(() => { setCurrentYear(new Date().getFullYear()); }, []);

  useEffect(() => {
    if ((isGeneratingPdf || isGeneratingExcel || isGeneratingPaGamO || isGeneratingPaGamOQuizGroup) && fileProgressSectionRef.current) {
      const timer = setTimeout(() => {
        fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isGeneratingPdf, isGeneratingExcel, isGeneratingPaGamO, isGeneratingPaGamOQuizGroup]);

  useEffect(() => {
    if (isGeneratingQuizResultsPdf && fileProgressSectionRef.current) {
      const timer = setTimeout(() => {
        fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isGeneratingQuizResultsPdf]);

  useEffect(() => {
    if (inputMode === 'text' && textInputAreaRef.current) {
      const timer = setTimeout(() => {
        textInputAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [inputMode]);

  useEffect(() => {
    if (preparedPaGamOData) {
      try {
        exportPIRLStoPaGamOQuizGroup(preparedPaGamOData, toast, fileProgressCallback);
      } catch (e: any) {
        toast({
          title: 'PaGamO 題組檔案生成失敗',
          description: e.message || '無法生成檔案，請稍後再試。',
          variant: 'destructive',
        });
        setFileGenerationMessage(`PaGamO 題組檔案生成失敗: ${e.message || '未知錯誤'}`);
        setFileGenerationProgress(0);
      } finally {
        setPreparedPaGamOData(null);
        setIsGeneratingPaGamOQuizGroup(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparedPaGamOData, toast]);

  const handleModeChange = (newMode: InputMode) => {
    setInputMode(newMode);
    if (newMode === 'image') setInputText(''); else setImageFiles([]);
    setGeneratedQuestionsOutput(null);
    setError(null);
    setIsQuizActive(false);
    setCurrentShareLink('');
  };

  const handleImageFilesChange = useCallback((files: File[]) => {
    setImageFiles(files);
    setInputText('');
    setGeneratedQuestionsOutput(null);
    setError(null);
    setIsQuizActive(false);
    setCurrentShareLink('');
    if (files.length > 0 && generateButtonRef.current) {
      const timer = setTimeout(() => {
        generateButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleInputTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setImageFiles([]);
    setGeneratedQuestionsOutput(null);
    setError(null);
    setIsQuizActive(false);
    setCurrentShareLink('');
  }, []);

  const handleGenerateQuestions = useCallback(async () => {
    const isReady = (inputMode === 'image' && imageFiles.length > 0) || (inputMode === 'text' && inputText.trim().length > 0);
    if (!isReady) {
      toast({
        title: inputMode === 'image' ? '沒有圖片' : '沒有文字',
        description: inputMode === 'image' ? '請先上傳至少一張圖片。' : '在文字區塊中輸入或貼上內容。',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedQuestionsOutput(null);
    setIsQuizActive(false);
    setCurrentShareLink('');
    setTimeout(() => {
      loadingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    const updateDisplayProgress = (progress: number, message: string) => {
      setLoadingMessage(message);
      setLoadingProgress(progress);
    };

    updateDisplayProgress(8, '✨ 準備開始處理...');
    let cancelSimProgress: (() => void) | null = null;
    try {
      let result: GeneratePirlsQuestionsOutput | null = null;
      if (inputMode === 'image') {
        updateDisplayProgress(12, '📷 正在壓縮圖片以加速上傳...');
        const photoDataUris: string[] = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const uri = await resizeImage(imageFiles[i]);
          photoDataUris.push(uri);
          const pct = 12 + ((i + 1) / imageFiles.length) * 18;
          updateDisplayProgress(pct, `📷 已處理 ${i + 1}/${imageFiles.length} 張圖片...`);
        }
        if (photoDataUris.length === 0) throw new Error('無法處理圖片，請確認檔案是否正確。');
        updateDisplayProgress(32, '🚀 正在上傳圖片至 AI 伺服器...');
        cancelSimProgress = simulateProgress(35, updateDisplayProgress, true);
        result = await generatePirlsQuestions({ photoDataUris, questionMode, languageMode, turnstileToken });
        cancelSimProgress();
        cancelSimProgress = null;
        if (result?.articleContent) setInputText(result.articleContent);
      } else {
        updateDisplayProgress(15, '📝 正在打包文章內容...');
        await new Promise((r) => setTimeout(r, 200));
        updateDisplayProgress(30, '🚀 正在傳送至 AI 伺服器...');
        cancelSimProgress = simulateProgress(32, updateDisplayProgress, false);
        result = await generatePirlsQuestionsFromText({ text: inputText, questionMode, languageMode, turnstileToken });
        cancelSimProgress();
        cancelSimProgress = null;
      }

      if (result && result.questions && result.questions.length > 0) {
        updateDisplayProgress(100, '題目已成功生成！');
        setGeneratedQuestionsOutput(result);
        setReadingSource({ text: inputMode === 'text' ? inputText : result.articleContent, images: inputMode === 'image' ? [...imageFiles] : [] });
        toast({
          title: '成功！',
          description: 'PIRLS 題目已生成。',
          className: 'bg-sage border-sage-deep text-ink',
        });
        setTurnstileResetSignal(s => s + 1);
        setTimeout(() => {
          resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        throw new Error('APP未能成功生成題目或有效內容。');
      }
    } catch (err: any) {
      const errorMessage = err.message || '發生未知錯誤，請稍後再試。';
      setError(errorMessage);
      toast({ title: '生成失敗', description: errorMessage, variant: 'destructive' });
      updateDisplayProgress(loadingProgress, '處理時發生錯誤');
      setTurnstileResetSignal(s => s + 1);
    } finally {
      if (cancelSimProgress) cancelSimProgress();
      setIsLoading(false);
    }
  }, [inputMode, imageFiles, inputText, toast, questionMode, languageMode, loadingProgress, turnstileToken]);

  const fileProgressCallback: ProgressCallback = (progress, message) => {
    setFileGenerationProgress(progress);
    setFileGenerationMessage(message);
  };

  const updateProgressCallback: ProgressCallback = (progress, message) => {
    setFileGenerationProgress(progress);
    setFileGenerationMessage(message);
  };

  const handleDownloadPdf = async () => {
    if (!generatedQuestionsOutput) {
      toast({ title: '無法下載 PDF', description: '請先生成題目。', variant: 'destructive' });
      return;
    }
    if (inputMode === 'image' && imageFiles.length === 0 && (!inputText || inputText.trim().length === 0)) {
      toast({ title: '無法下載 PDF', description: '請確認已上傳圖片或輸入文字以匯出包含文本的 PDF。', variant: 'destructive' });
      return;
    }
    if (inputMode === 'text' && inputText.trim().length === 0) {
      toast({ title: '無法下載 PDF', description: '文本內容為空，無法生成 PDF。', variant: 'destructive' });
      return;
    }
    setIsGeneratingPdf(true);
    setFileGenerationProgress(0);
    setFileGenerationMessage('正在初始化 PDF 產生程序...');
    setTimeout(() => fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    try {
      await exportPIRLStoPDF({
        questionsOutput: generatedQuestionsOutput,
        imageFiles: inputMode === 'image' ? imageFiles : [],
        inputText,
        showToast: toast,
        updateProgressCallback,
      });
    } catch (pdfError: any) {
      toast({ title: 'PDF 生成失敗', description: pdfError.message || '無法生成 PDF 檔案，請稍後再試。', variant: 'destructive' });
      setFileGenerationMessage(`PDF 生成失敗: ${pdfError.message || '未知錯誤'}`);
      setFileGenerationProgress(0);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!generatedQuestionsOutput) { toast({ title: '無法下載', description: '請先生成題目。', variant: 'destructive' }); return; }
    setIsGeneratingExcel(true);
    setFileGenerationProgress(0);
    setFileGenerationMessage('正在初始化檔案產生程序...');
    setTimeout(() => fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    try {
      await exportPIRLStoExcel(generatedQuestionsOutput, toast, fileProgressCallback);
    } catch (excelError: any) {
      toast({ title: '檔案生成失敗', description: excelError.message || '無法生成檔案，請稍後再試。', variant: 'destructive' });
      setFileGenerationMessage(`檔案生成失敗: ${excelError.message || '未知錯誤'}`);
      setFileGenerationProgress(0);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const handleDownloadPaGamO = async () => {
    if (!generatedQuestionsOutput) { toast({ title: '無法下載', description: '請先生成題目。', variant: 'destructive' }); return; }
    setIsGeneratingPaGamO(true);
    setFileGenerationProgress(0);
    setFileGenerationMessage('正在初始化 PaGamO 檔案產生程序...');
    setTimeout(() => fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    try {
      await exportPIRLStoPaGamO(generatedQuestionsOutput, toast, fileProgressCallback);
    } catch (paGamOError: any) {
      toast({ title: 'PaGamO 檔案生成失敗', description: paGamOError.message || '無法生成檔案，請稍後再試。', variant: 'destructive' });
      setFileGenerationMessage(`PaGamO 檔案生成失敗: ${paGamOError.message || '未知錯誤'}`);
      setFileGenerationProgress(0);
    } finally {
      setIsGeneratingPaGamO(false);
    }
  };

  const handleDownloadPaGamOQuizGroup = () => {
    if (!generatedQuestionsOutput || !generatedQuestionsOutput.title || !generatedQuestionsOutput.articleContent) {
      toast({ title: '無法下載題組', description: '請先生成題目。生成的結果似乎不完整。', variant: 'destructive' });
      return;
    }
    setIsGeneratingPaGamOQuizGroup(true);
    setFileGenerationProgress(0);
    setFileGenerationMessage('正在準備 PaGamO 題組資料...');
    setTimeout(() => fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    try {
      setFileGenerationMessage('資料準備完成，等待下載觸發...');
      setFileGenerationProgress(75);
      setPreparedPaGamOData({
        questionsOutput: generatedQuestionsOutput,
        articleContent: generatedQuestionsOutput.articleContent,
        articleTitle: generatedQuestionsOutput.title,
      });
    } catch (paGamOError: any) {
      toast({ title: 'PaGamO 題組資料準備失敗', description: paGamOError.message || '無法準備檔案資料，請稍後再試。', variant: 'destructive' });
      setFileGenerationMessage(`PaGamO 題組資料準備失敗: ${paGamOError.message || '未知錯誤'}`);
      setFileGenerationProgress(0);
      setIsGeneratingPaGamOQuizGroup(false);
    }
  };

  const handleStartQuiz = () => {
    if (generatedQuestionsOutput && (imageFiles.length > 0 || inputText.trim().length > 0)) {
      setIsQuizActive(true);
      setTimeout(() => resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } else {
      toast({ title: '無法開始測驗', description: '請先提供內容 (圖片或文字) 並成功生成題目。', variant: 'destructive' });
    }
  };

  const handleExitQuiz = () => setIsQuizActive(false);

  const handleShowQuizResultsPdfProgress = (show: boolean) => setIsGeneratingQuizResultsPdf(show);
  const handleUpdateQuizResultsPdfProgress: ProgressCallback = (progress, message) => {
    setFileGenerationProgress(progress);
    setFileGenerationMessage(message);
  };

  const handleShareQuiz = async () => {
    if (!generatedQuestionsOutput || (imageFiles.length === 0 && inputText.trim().length === 0)) {
      toast({ title: "無法分享", description: "請先生成題目並上傳圖片或輸入文字。", variant: "destructive" });
      return;
    }
    setIsSharingQuiz(true);
    setCurrentShareLink('');
    setIsShareDialogOpen(true);
    try {
      const imageFilesDataURIs = inputMode === 'image' ? await Promise.all(imageFiles.map(file => resizeImage(file))) : [];
      const { quizId } = await createSharedQuiz({
        questionsOutput: generatedQuestionsOutput,
        imageFilesDataURIs,
        inputText: inputMode === 'text' ? inputText : '',
      });
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      const newShareLink = `${window.location.origin}${basePath}/quiz/?id=${quizId}`;
      setCurrentShareLink(newShareLink);
      toast({ title: "臨時分享連結已生成", description: "連結已顯示在分享視窗中。", className: 'bg-sage border-sage-deep text-ink' });
    } catch (shareError: any) {
      setCurrentShareLink('');
      toast({ title: "分享失敗", description: `無法生成臨時分享連結: ${shareError.message || '未知錯誤'}`, variant: "destructive" });
    } finally {
      setIsSharingQuiz(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!currentShareLink) { toast({ title: "無連結可複製", description: "請先生成分享連結。", variant: "destructive" }); return; }
    navigator.clipboard.writeText(currentShareLink).then(() => {
      toast({ title: "連結已複製", description: "臨時分享連結已複製到剪貼簿。", className: 'bg-sage border-sage-deep text-ink' });
    }).catch(() => {
      toast({ title: "複製失敗", description: "無法複製連結，請手動複製。", variant: "destructive" });
    });
  };

  const isAnyDownloading = isGeneratingPdf || isGeneratingExcel || isGeneratingPaGamO || isGeneratingPaGamOQuizGroup || isGeneratingQuizResultsPdf;
  const ready = (inputMode === 'image' && imageFiles.length > 0) || (inputMode === 'text' && inputText.trim().length > 0);

  // 結果頁四層次分布計算
  const distribution = generatedQuestionsOutput
    ? generatedQuestionsOutput.questions.reduce<Record<string, number>>((acc, q) => {
        acc[q.pirlsLevel] = (acc[q.pirlsLevel] || 0) + 1;
        return acc;
      }, {})
    : {};

  return (
    <div className="min-h-screen px-5 sm:px-9 pt-7 pb-20 text-ink">
      <div className="max-w-[1240px] mx-auto">

        {/* ===== Top Nav ===== */}
        <nav className="flex justify-between items-center gap-3 px-5 sm:px-[22px] py-3.5 bg-card border-neo rounded-full shadow-neo flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-cream border-neo flex items-center justify-center p-1 overflow-hidden shrink-0">
              <PirlsLogo className="w-full h-full" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-extrabold leading-tight flex items-center gap-1.5 flex-wrap">
                QuestionCraft
                <span className="bg-lemon border-neo rounded-md px-2 py-px text-[11px] leading-tight font-extrabold">PRO</span>
              </div>
              <div className="text-[12px] text-muted-foreground mt-0.5">石門國小 · PIRLS 閱讀理解四層次出題助手</div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <HelpDialog />
            <a
              href="https://cagoooo.github.io/Akai/wish/"
              target="_blank"
              rel="noopener noreferrer"
              title="老師您好！點此給予使用回饋並為這個工具評分（⭐ 1-5 顆星）"
              aria-label="使用回饋與星星評分"
            >
              <PillBtn color="bg-peach" sm className="!gap-1.5 !px-3.5">
                <MessageSquareHeart className="h-4 w-4 shrink-0" />
                <span className="font-extrabold whitespace-nowrap">使用回饋</span>
                <span className="inline-flex items-center gap-0.5 ml-0.5 text-amber-500">
                  <StarIcon className="h-3 w-3 fill-current" strokeWidth={2.2} />
                  <StarIcon className="h-3 w-3 fill-current" strokeWidth={2.2} />
                  <StarIcon className="h-3 w-3 fill-current" strokeWidth={2.2} />
                </span>
              </PillBtn>
            </a>
          </div>
        </nav>

        {/* ===== Hero ===== */}
        {!isQuizActive && (
          <NeoCard className="mt-6 px-7 sm:px-12 py-9 sm:py-11 relative overflow-hidden">
            {/* 裝飾色塊 */}
            <div aria-hidden className="hidden md:block absolute -top-12 -right-12 w-60 h-60 rounded-full bg-peach opacity-55 pointer-events-none" />
            <div aria-hidden className="hidden md:block absolute -bottom-16 right-[90px] w-[150px] h-[150px] rounded-full bg-sky opacity-50 pointer-events-none" />
            <div aria-hidden className="hidden md:block absolute top-12 right-[220px] w-[70px] h-[70px] rounded-full bg-sage opacity-60 pointer-events-none" />
            <div aria-hidden className="hidden md:block absolute top-[130px] right-[90px] w-[26px] h-[26px] rounded-full bg-ink pointer-events-none" />
            {/* 手繪裝飾 */}
            <Star size={28} color="#F2DC83" className="hidden md:block absolute top-9 right-[280px] animate-pirls-bob" />
            <Star size={20} color="#F0A6B5" className="hidden md:block absolute bottom-20 right-[260px] animate-pirls-bob [animation-delay:0.5s]" />
            <Spark size={22} color="#3D2E1E" className="hidden md:block absolute top-[200px] right-12 animate-pirls-bob [animation-delay:0.8s]" />

            <div className="relative z-[2] max-w-[720px]">
              <span className="inline-flex items-center gap-2 bg-cream border-neo rounded-full px-3.5 py-1.5 text-xs font-bold mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                AI 自動出題 · 三步驟完成
              </span>
              <h1 className="m-0 font-extrabold tracking-tight leading-[1.05] text-[40px] sm:text-[52px] md:text-[60px]">
                把任何文章，<br />
                變成
                <span
                  className="relative inline-block px-1.5"
                  style={{ background: 'linear-gradient(180deg, transparent 60%, #F5C9A8 60%)' }}
                >
                  會讀得懂
                  <Squiggle color="#E89B7B" className="absolute -bottom-2.5 left-2" />
                </span>
                的題目。
              </h1>
              <p className="mt-4 text-[15px] sm:text-[17px] leading-[1.7] text-ink-soft max-w-[560px]">
                上傳一張課文照片或貼上一段文字，AI 會依據 PIRLS 國際閱讀素養架構，自動為您設計選擇題、干擾選項與詳細解析。
              </p>
              <div className="flex gap-2.5 mt-6 sm:mt-7 flex-wrap">
                {[
                  { n: 1, t: '提供素材', c: 'bg-peach' },
                  { n: 2, t: '選擇規格', c: 'bg-sage' },
                  { n: 3, t: '一鍵生成', c: 'bg-sky' },
                ].map((s) => (
                  <div
                    key={s.n}
                    className="flex items-center gap-2.5 bg-card border-neo rounded-full pl-2 pr-4 py-2 text-sm font-bold shadow-neo-sm"
                  >
                    <div className={cn('w-7 h-7 rounded-full border-neo flex items-center justify-center font-extrabold text-sm', s.c)}>
                      {s.n}
                    </div>
                    {s.t}
                  </div>
                ))}
              </div>
            </div>
          </NeoCard>
        )}

        {/* ===== Workflow：Upload + Settings（idle 階段） ===== */}
        {!isQuizActive && !generatedQuestionsOutput && !isLoading && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-5">
            {/* Upload card */}
            <NeoCard className="p-6">
              <div className="flex justify-between items-center flex-wrap gap-3 mb-5">
                <div>
                  <div className="text-[11px] font-extrabold tracking-[0.15em] text-muted-foreground mb-1">STEP 01</div>
                  <div className="text-[22px] font-extrabold">提供素材</div>
                </div>
                {/* TabPills */}
                <div className="inline-flex bg-cream border-neo rounded-full p-1">
                  {([
                    { id: 'image', l: '上傳圖片', icon: <ImageIcon className="h-4 w-4" /> },
                    { id: 'text', l: '貼上文本', icon: <FileText className="h-4 w-4" /> },
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleModeChange(t.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors',
                        inputMode === t.id ? 'bg-ink text-cream' : 'bg-transparent text-ink hover:bg-cream-deep'
                      )}
                    >
                      {t.icon} {t.l}
                    </button>
                  ))}
                </div>
              </div>

              {inputMode === 'image' ? (
                <FileUpload
                  onFilesSelected={handleImageFilesChange}
                  isLoading={isLoading || isAnyDownloading}
                />
              ) : (
                <div ref={textInputAreaRef}>
                  <Textarea
                    placeholder="請在此貼上您想出題的文章內容…"
                    value={inputText}
                    onChange={handleInputTextChange}
                    className="w-full min-h-[220px] bg-cream border-[2px] border-ink rounded-[18px] p-4 text-[15px] leading-[1.7] text-ink resize-y focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={isLoading}
                  />
                  <div className="mt-2.5 flex justify-between text-xs text-muted-foreground">
                    <span>支援 PDF / Word / 網頁複製貼上</span>
                    <span className="font-mono">{inputText.length} 字</span>
                  </div>
                </div>
              )}
            </NeoCard>

            {/* Settings */}
            <div className="flex flex-col gap-4">
              <SettingCard
                step="02"
                title="題組數量"
                emoji="🧩"
                color="bg-sage"
                value={questionMode}
                onChange={(v) => !isLoading && setQuestionMode(v as '8-questions' | '10-questions')}
                disabled={isLoading || isAnyDownloading}
                options={[
                  { id: '8-questions', t: '標準 8 題', d: '四層次各 2 題' },
                  { id: '10-questions', t: '延伸 10 題', d: '加強提取與推論' },
                ]}
              />
              <SettingCard
                step="03"
                title="題目語言"
                emoji="🌏"
                color="bg-sky"
                value={languageMode}
                onChange={(v) => !isLoading && setLanguageMode(v as 'zh-TW' | 'en')}
                disabled={isLoading || isAnyDownloading}
                options={[
                  { id: 'zh-TW', t: '繁體中文', d: '完整中文呈現' },
                  { id: 'en', t: 'English', d: '英文題幹與選項，解析中文' },
                ]}
              />
            </div>
          </div>
        )}

        {/* ===== Turnstile ===== */}
        {!isQuizActive && !generatedQuestionsOutput && !isLoading && (
          <div className="mt-5">
            <TurnstileGate onToken={setTurnstileToken} resetSignal={turnstileResetSignal} />
          </div>
        )}

        {!isQuizActive && !generatedQuestionsOutput && !isLoading && (
          <Alert className="mt-5 border-[1.5px] border-ink bg-lemon/60 rounded-[18px] shadow-neo-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>請珍惜 AI 出題額度</AlertTitle>
            <AlertDescription className="leading-6">
              題組生成會消耗共用的 Gemini API 額度。每位使用者每小時最多可生成 5 次，請確認素材與題數後再產生，避免只是測試或連續重複生成。
            </AlertDescription>
          </Alert>
        )}

        {/* ===== CTA：大型珊瑚紅生成按鈕 ===== */}
        {!isQuizActive && !generatedQuestionsOutput && !isLoading && (
          <button
            ref={generateButtonRef}
            onClick={handleGenerateQuestions}
            disabled={!ready || isLoading || isAnyDownloading}
            className={cn(
              'mt-6 w-full px-6 py-6 rounded-[24px] border-neo shadow-neo-lg',
              'flex items-center justify-center gap-3',
              'text-[20px] sm:text-[22px] font-extrabold transition-all',
              'hover:-translate-y-0.5 hover:shadow-neo-xl active:translate-y-1 active:shadow-neo-none',
              ready && !isLoading
                ? 'bg-coral text-white cursor-pointer'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                處理中，請稍候...
              </>
            ) : (
              <>
                <span className="text-[24px] sm:text-[26px]">🚀</span>
                {ready ? '開始生成 PIRLS 四層次題目' : '請先提供素材（上傳圖片或貼上文本）'}
              </>
            )}
          </button>
        )}

        {/* ===== Loading Bar ===== */}
        {isLoading && (
          <div ref={loadingSectionRef} className="mt-6">
            <NeoCard className="p-6">
              <div className="flex items-center gap-3.5 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl bg-lemon border-neo flex items-center justify-center text-2xl shadow-neo-sm animate-pirls-spin"
                  aria-hidden
                >
                  🧠
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[17px] font-extrabold">AI 努力思考中…</div>
                  <div className="text-[13px] text-muted-foreground mt-0.5 truncate">{loadingMessage}</div>
                </div>
                <div className="font-mono text-[22px] font-extrabold tabular-nums">{Math.round(loadingProgress)}%</div>
              </div>
              <div className="h-3.5 bg-cream border-neo rounded-full overflow-hidden">
                <div
                  className="h-full transition-[width] duration-300 ease-out"
                  style={{
                    width: `${loadingProgress}%`,
                    background: 'linear-gradient(90deg, #F5C9A8, #E89B7B)',
                    borderRight: loadingProgress < 100 ? '1.5px solid #3D2E1E' : 'none',
                  }}
                />
              </div>
            </NeoCard>
          </div>
        )}

        {/* ===== Error ===== */}
        {error && !isLoading && (
          <div className="mt-6">
            <Alert variant="destructive" className="border-[1.5px] border-ink rounded-[18px] shadow-neo-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>錯誤</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* ===== Result section ===== */}
        {generatedQuestionsOutput && !isLoading && (
          <section ref={resultsSectionRef} className="mt-6 flex flex-col gap-5">
            {/* File generation progress */}
            {isAnyDownloading && (
              <NeoCard ref={fileProgressSectionRef} className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <div className="font-extrabold text-base">檔案處理中…</div>
                  <div className="ml-auto font-mono font-extrabold tabular-nums">{Math.round(fileGenerationProgress)}%</div>
                </div>
                <div className="h-3 bg-cream border-neo rounded-full overflow-hidden">
                  <div
                    className="h-full transition-[width] duration-300 ease-out bg-coral"
                    style={{ width: `${fileGenerationProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{fileGenerationMessage}</p>
              </NeoCard>
            )}

            {!isQuizActive && (
              <>
                {/* Result header：四層次分布 */}
                <NeoCard className="p-6">
                  <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-2 bg-sage/55 border-neo rounded-full px-3 py-1 text-xs font-extrabold mb-2.5">
                        <span>✓</span> 已生成 {generatedQuestionsOutput.questions.length} 題
                      </span>
                      <div className="text-[20px] sm:text-[24px] font-extrabold truncate">
                        {generatedQuestionsOutput.title || 'AI 自動生成題組'}
                      </div>
                      <div className="text-[13px] text-muted-foreground mt-1">
                        由 AI 自動分析文章內容生成 · 涵蓋 PIRLS 四層次
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(Object.keys(PIRLS_LEVEL_META) as PirlsLevel[]).map((k) => {
                      const m = PIRLS_LEVEL_META[k];
                      return (
                        <div key={k} className="bg-cream border-neo rounded-[14px] px-3.5 py-3 flex items-center gap-2.5">
                          <div className={cn('w-9 h-9 rounded-[10px] border-neo flex items-center justify-center text-base', m.bg)}>
                            {m.emoji}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] text-muted-foreground font-bold">{m.label}</div>
                            <div className="text-[18px] font-extrabold font-mono tabular-nums">
                              {distribution[k] || 0}
                              <span className="text-[11px] text-muted-foreground ml-0.5">題</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </NeoCard>

                {/* Action bar */}
                <NeoCard className="p-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="text-[13px] font-bold text-muted-foreground mr-1">匯出 / 分享 →</div>
                    <PillBtn onClick={handleStartQuiz} color="bg-sage" sm disabled={isAnyDownloading}>
                      ▶ 開始線上測驗
                    </PillBtn>
                    <PillBtn onClick={handleDownloadPdf} color="bg-peach" sm disabled={isAnyDownloading}>
                      {isGeneratingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '📄'} 教師 PDF（含解答）
                    </PillBtn>
                    <PillBtn onClick={handleDownloadExcel} color="bg-sky" sm disabled={isAnyDownloading}>
                      {isGeneratingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '📊'} Loilonote
                    </PillBtn>
                    <PillBtn onClick={handleDownloadPaGamO} color="bg-lemon" sm disabled={isAnyDownloading}>
                      {isGeneratingPaGamO ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '🎮'} PaGamO
                    </PillBtn>
                    <PillBtn onClick={handleDownloadPaGamOQuizGroup} color="bg-rose" sm disabled={isAnyDownloading}>
                      {isGeneratingPaGamOQuizGroup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '📚'} PaGamO 題組
                    </PillBtn>
                    <PlatformExportDialog data={generatedQuestionsOutput} readingSource={readingSource} disabled={isAnyDownloading} />
                    <div className="ml-auto">
                      <ShareDialog
                        open={isShareDialogOpen}
                        onOpenChange={setIsShareDialogOpen}
                        onShareClick={handleShareQuiz}
                        onCopyClick={handleCopyShareLink}
                        triggerDisabled={isSharingQuiz || isAnyDownloading}
                        isSharingQuiz={isSharingQuiz}
                        currentShareLink={currentShareLink}
                      />
                    </div>
                  </div>
                </NeoCard>
              </>
            )}

            {/* Quiz / Question list */}
            {isQuizActive ? (
              <QuizView
                questionsOutput={generatedQuestionsOutput}
                imageFiles={imageFiles}
                inputText={inputText}
                onExitQuiz={handleExitQuiz}
                toast={toast}
                showFileGenerationProgress={handleShowQuizResultsPdfProgress}
                updateFileGenerationProgress={handleUpdateQuizResultsPdfProgress}
                isGeneratingQuizResultsPdf={isGeneratingQuizResultsPdf}
              />
            ) : (
              <Accordion type="single" collapsible className="w-full flex flex-col gap-3.5">
                {generatedQuestionsOutput.questions.map((q, index) => (
                  <QuestionCard
                    key={index}
                    questionItem={q}
                    questionNumber={index + 1}
                    className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                    style={{ animationDelay: `${index * 80}ms` }}
                  />
                ))}
              </Accordion>
            )}
          </section>
        )}

        {/* ===== Footer ===== */}
        <footer className="mt-14 bg-ink text-cream rounded-[24px] px-7 py-7 flex justify-between items-center flex-wrap gap-4">
          <div className="min-w-0">
            <div className="text-base font-extrabold">PIRLS QuestionCraft PRO</div>
            <div className="text-[13px] opacity-75 mt-1">
              Made with <span className="text-rose">❤</span> by{' '}
              <a
                href="https://www.smes.tyc.edu.tw/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline-offset-4 hover:underline"
              >
                桃園市石門國小資訊組 阿凱老師
              </a>
              <span className="mx-1.5 opacity-60">·</span>
              <span className="opacity-75">© {currentYear ?? ''}</span>
            </div>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <a
              href="https://document-ai-companion-ipad4.replit.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <PillBtn color="bg-peach" sm>🦄 創建專屬助手</PillBtn>
            </a>
            <a
              href="https://line.me/R/ti/p/@733oiboa?oat_content=url&ts=05120012"
              target="_blank"
              rel="noopener noreferrer"
            >
              <PillBtn color="bg-lemon" sm>🐝 點石成金</PillBtn>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ===== SettingCard 子元件 ===== */
function SettingCard({
  step,
  title,
  emoji,
  color,
  options,
  value,
  onChange,
  disabled,
}: {
  step: string;
  title: string;
  emoji: string;
  color: string;
  options: { id: string; t: string; d: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <NeoCard className="p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className={cn('w-9 h-9 rounded-xl border-neo flex items-center justify-center text-lg shadow-neo-sm', color)}>
          {emoji}
        </div>
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.15em] text-muted-foreground">STEP {step}</div>
          <div className="font-extrabold text-[17px]">{title}</div>
        </div>
      </div>
      <div className="flex flex-col gap-2 mt-3.5">
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              disabled={disabled}
              className={cn(
                'flex justify-between items-center px-4 py-3 rounded-[14px] text-left transition-all',
                selected
                  ? 'bg-cream border-[2px] border-ink'
                  : 'bg-card border-[1.5px] border-line hover:border-ink/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="min-w-0">
                <div className="font-bold text-sm text-ink">{o.t}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{o.d}</div>
              </div>
              <div
                className={cn(
                  'w-[22px] h-[22px] rounded-full border-neo flex items-center justify-center text-xs font-extrabold shrink-0 ml-3',
                  selected ? 'bg-ink text-white' : 'bg-card text-transparent'
                )}
              >
                {selected ? '✓' : ''}
              </div>
            </button>
          );
        })}
      </div>
    </NeoCard>
  );
}
