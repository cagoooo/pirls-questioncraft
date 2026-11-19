// src/components/QuizView.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { GeneratePirlsQuestionsOutput } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, XCircle, BookOpen, CheckCircle, AlertTriangle, CheckSquare, RotateCcw, LogOut, FileText, Loader2, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import type { Toast } from '@/hooks/use-toast';
import { exportQuizResultsToPDF } from '@/lib/generateQuizResultsPdf';
import { submitQuizAnswer, type StudentAnswerSubmission } from '@/lib/api';
import type { StudentInfo } from '@/app/quiz/page';
import { QuizEndScreen } from '@/components/QuizEndScreen';
import { saveQuizProgress, clearQuizProgress, setQuizAnswering, getOrCreateSubmitId, clearSubmitId } from '@/lib/quizSession';
import { SubmitStatusBox, type SubmitStatus } from '@/components/SubmitStatusBox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


type PirlsQuestion = GeneratePirlsQuestionsOutput['questions'][0];
type ProgressCallback = (progress: number, message: string) => void;

interface QuizViewProps {
  questionsOutput: GeneratePirlsQuestionsOutput;
  imageFiles: File[];
  imageFilesDataURIs?: string[];
  inputText?: string;
  studentInfo?: StudentInfo;
  /** B.16: 從共享連結進入時帶 quizId，交卷會寫進 submissions/{quizId}/students */
  quizId?: string;
  onExitQuiz: () => void;
  /** 學生作答頁：按「退出測驗」先確認，再顯示結束畫面與題目回饋總結（老師預覽不開，維持直接離開） */
  endScreen?: boolean;
  /** 學生作答頁：上次沒寫完、選擇「接著作答」時帶入的進度 */
  initialProgress?: { answers: (number | null)[]; currentIndex: number };
  toast: typeof Toast;
  showFileGenerationProgress: (show: boolean) => void;
  updateFileGenerationProgress: ProgressCallback;
  isGeneratingQuizResultsPdf: boolean;
}

const pirlsLevelDetails: Record<PirlsQuestion['pirlsLevel'], { label: string; icon?: React.ElementType; badgeVariant: VariantProps<typeof badgeVariants>['variant'], borderColorClass: string }> = {
  'locate & retrieve': { label: '訊息提取與檢索', badgeVariant: 'pirlsLocate', borderColorClass: 'border-blue-500' },
  'make straightforward inferences': { label: '直接推論', badgeVariant: 'pirlsInfer', borderColorClass: 'border-green-500' },
  'interpret & integrate': { label: '詮釋與整合', badgeVariant: 'pirlsInterpret', borderColorClass: 'border-yellow-500' },
  'evaluate & critique': { label: '評估與批判', badgeVariant: 'pirlsEvaluate', borderColorClass: 'border-purple-500' },
};

const optionLabels = ['A', 'B', 'C', 'D'];

interface QuizResultItem {
  questionText: string;
  options: string[];
  userAnswerIndex: number | null;
  correctAnswerIndex: number;
  isCorrect: boolean;
  explanation: string;
  pirlsLevel: PirlsQuestion['pirlsLevel'];
}

type QuizState = 'answering' | 'results' | 'ended';

const MIN_SCALE = 0.3;
const MAX_SCALE = 4;
const SCALE_STEP = 0.2;

export function QuizView({
  questionsOutput,
  imageFiles,
  imageFilesDataURIs,
  inputText,
  studentInfo,
  quizId,
  onExitQuiz,
  endScreen = false,
  initialProgress,
  toast,
  showFileGenerationProgress,
  updateFileGenerationProgress,
  isGeneratingQuizResultsPdf
}: QuizViewProps) {
  const questionCount = questionsOutput.questions.length;
  const resumeOk = !!initialProgress && initialProgress.answers.length === questionCount;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() =>
    resumeOk ? Math.min(Math.max(initialProgress!.currentIndex, 0), questionCount - 1) : 0
  );
  const [previousQuestionIndex, setPreviousQuestionIndex] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>(() =>
    resumeOk ? [...initialProgress!.answers] : Array(questionCount).fill(null)
  );
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [quizState, setQuizState] = useState<QuizState>('answering');
  const [quizResults, setQuizResults] = useState<QuizResultItem[] | null>(null);
  const quizResultsTopRef = useRef<HTMLDivElement>(null);
  const [isSharingPdfInternal, setIsSharingPdfInternal] = useState(false);
  const [isCurrentQuestionAnswered, setIsCurrentQuestionAnswered] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [endedEarly, setEndedEarly] = useState(false);
  // v0.3.9：交卷狀態（送出中／已送到／送不出去），送不出去時讓學生按「再送一次」
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('none');
  const pendingSubmissionRef = useRef<StudentAnswerSubmission | null>(null);
  const submitRunRef = useRef(0);

  // 送出中或送不出去時，關頁面前先提醒
  useEffect(() => {
    if (submitStatus !== 'sending' && submitStatus !== 'failed') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [submitStatus]);


  // State for quiz image dialog
  const [isQuizImageDialogOpen, setIsQuizImageDialogOpen] = useState(false);
  const [selectedQuizImageForDialog, setSelectedQuizImageForDialog] = useState<string | null>(null);
  const [dialogQuizImageScale, setDialogQuizImageScale] = useState(1);
  const [quizImageOffset, setQuizImageOffset] = useState({ x: 0, y: 0 });
  const [isQuizImagePanning, setIsQuizImagePanning] = useState(false);
  const panQuizStartRef = useRef({ x: 0, y: 0 });
  const quizImageDisplayAreaRef = useRef<HTMLDivElement>(null);


  const currentQuestion = useMemo(() => {
    return questionsOutput.questions[currentQuestionIndex];
  }, [questionsOutput, currentQuestionIndex]);

  const levelDetail = useMemo(() => {
    if (quizState === 'answering' && currentQuestion) {
      return pirlsLevelDetails[currentQuestion.pirlsLevel];
    }
    return null;
  }, [currentQuestion, quizState]);

  useEffect(() => {
    if (imageFilesDataURIs && imageFilesDataURIs.length > 0) {
      setImagePreviews(imageFilesDataURIs);
    } else if (imageFiles && imageFiles.length > 0) {
      const generatePreviews = async () => {
        const previews = await Promise.all(
          imageFiles.map(file => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          })
        );
        setImagePreviews(previews);
      };
      generatePreviews();
    }
  }, [imageFiles, imageFilesDataURIs]);

  useEffect(() => {
    if (quizState === 'results' && quizResults && quizResultsTopRef.current) {
      const timer = setTimeout(() => {
        quizResultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [quizState, quizResults]);

  // 學生作答頁：每答一題、每換一題就把進度存在這台裝置，頁面不小心關掉也能接著作答
  useEffect(() => {
    if (!endScreen || !quizId || !studentInfo || quizState !== 'answering') return;
    if (!selectedAnswers.some(a => a !== null)) return;
    saveQuizProgress(quizId, { studentInfo, answers: selectedAnswers, currentIndex: currentQuestionIndex });
  }, [endScreen, quizId, studentInfo, quizState, selectedAnswers, currentQuestionIndex]);

  // 學生作答中 → 不跳「有新版本可用」提示（見 VersionUpdateBanner）
  useEffect(() => {
    if (!endScreen) return;
    setQuizAnswering(quizState === 'answering');
    return () => setQuizAnswering(false);
  }, [endScreen, quizState]);

  useEffect(() => {
    if(previousQuestionIndex !== currentQuestionIndex) {
      setPreviousQuestionIndex(currentQuestionIndex);
      setIsCurrentQuestionAnswered(selectedAnswers[currentQuestionIndex] !== null);
    }
  }, [currentQuestionIndex, previousQuestionIndex, selectedAnswers]); 

  const handleQuizImageClick = (imageUrl: string) => {
    setSelectedQuizImageForDialog(imageUrl);
    setDialogQuizImageScale(1);
    setQuizImageOffset({ x: 0, y: 0 });
    setIsQuizImagePanning(false);
    setIsQuizImageDialogOpen(true);
  };

  const handleDialogQuizImageWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDialogQuizImageScale(prevScale => {
      let newScale;
      if (event.deltaY < 0) {
        newScale = prevScale + SCALE_STEP;
      } else {
        newScale = prevScale - SCALE_STEP;
      }
      const clampedScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
      if (clampedScale === 1) {
        setQuizImageOffset({ x: 0, y: 0 });
      }
      return clampedScale;
    });
  }, []);

  const zoomInQuizDialog = () => setDialogQuizImageScale(s => {
    const newScale = Math.min(s + SCALE_STEP, MAX_SCALE);
    if (newScale === 1) setQuizImageOffset({ x: 0, y: 0 });
    return newScale;
  });
  const zoomOutQuizDialog = () => setDialogQuizImageScale(s => {
    const newScale = Math.max(s - SCALE_STEP, MIN_SCALE);
    if (newScale === 1) setQuizImageOffset({ x: 0, y: 0 });
    return newScale;
  });
  const resetQuizZoomDialog = () => {
    setDialogQuizImageScale(1);
    setQuizImageOffset({ x: 0, y: 0 });
  };

  const handleQuizPanStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (dialogQuizImageScale <= 1) return;
    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    panQuizStartRef.current = { x: clientX - quizImageOffset.x, y: clientY - quizImageOffset.y };
    setIsQuizImagePanning(true);
  };

  useEffect(() => {
    const handleGlobalPanMove = (e: MouseEvent | TouchEvent) => {
      if (!isQuizImagePanning) return;
      if ('touches' in e && e.cancelable) e.preventDefault();

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      setQuizImageOffset({
        x: clientX - panQuizStartRef.current.x,
        y: clientY - panQuizStartRef.current.y,
      });
    };

    const handleGlobalPanEnd = () => {
      setIsQuizImagePanning(false);
    };

    if (isQuizImagePanning) {
      window.addEventListener('mousemove', handleGlobalPanMove);
      window.addEventListener('touchmove', handleGlobalPanMove, { passive: false });
      window.addEventListener('mouseup', handleGlobalPanEnd);
      window.addEventListener('touchend', handleGlobalPanEnd);
      window.addEventListener('mouseleave', handleGlobalPanEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalPanMove);
      window.removeEventListener('touchmove', handleGlobalPanMove);
      window.removeEventListener('mouseup', handleGlobalPanEnd);
      window.removeEventListener('touchend', handleGlobalPanEnd);
      window.removeEventListener('mouseleave', handleGlobalPanEnd);
    };
  }, [isQuizImagePanning]);


  const handleOptionChange = (value: string) => {
    if (isCurrentQuestionAnswered) return;
    const answerIndex = parseInt(value, 10);
    setSelectedAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestionIndex] = answerIndex;
      return newAnswers;
    });
    setIsCurrentQuestionAnswered(true);
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questionsOutput.questions.length - 1) {
      setPreviousQuestionIndex(currentQuestionIndex);
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setPreviousQuestionIndex(currentQuestionIndex);
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const processAndSetResults = (nextState: QuizState = 'results') => {
    const results: QuizResultItem[] = questionsOutput.questions.map((q, idx) => {
      const userAnswerIndex = selectedAnswers[idx];
      return {
        questionText: q.question,
        options: q.options,
        userAnswerIndex,
        correctAnswerIndex: q.correctAnswerIndex,
        isCorrect: userAnswerIndex === q.correctAnswerIndex,
        explanation: q.explanation,
        pirlsLevel: q.pirlsLevel,
      };
    });
    setQuizResults(results);
    setQuizState(nextState);

    // B.16: 從共享連結進入且有 studentInfo → 寫一筆 submission，best-effort（失敗不擋學生看結果）
    // 提早結束、一題都沒答時不送，避免老師儀表板多一筆 0 分紀錄
    const answeredCount = selectedAnswers.filter(a => a !== null).length;
    if (quizId && studentInfo && answeredCount > 0) {
      const correctCount = results.filter(r => r.isCorrect).length;
      const totalCount = results.length;
      const pirlsLevelStats: Record<string, { correct: number; total: number }> = {};
      results.forEach(r => {
        const stat = pirlsLevelStats[r.pirlsLevel] ?? { correct: 0, total: 0 };
        stat.total += 1;
        if (r.isCorrect) stat.correct += 1;
        pirlsLevelStats[r.pirlsLevel] = stat;
      });
      pendingSubmissionRef.current = {
        quizId,
        studentInfo,
        answers: selectedAnswers,
        correctCount,
        totalCount,
        pirlsLevelStats,
        clientSubmissionId: getOrCreateSubmitId(quizId),
      };
      // 作答進度等送成功才清掉：送不出去時學生重開頁面還能接回來再交一次
      void sendSubmission();
    } else if (quizId) {
      // 已經結束、沒有要送的（一題都沒答或老師預覽）：暫存的進度用不到了，清掉
      clearQuizProgress(quizId);
    }
  };

  /** 交卷：失敗自動重試 3 次（2、5、10 秒後），還是不行就顯示「再送一次」 */
  const sendSubmission = async () => {
    const payload = pendingSubmissionRef.current;
    if (!payload) return;
    const run = ++submitRunRef.current;
    setSubmitStatus('sending');
    const delays = [0, 2000, 5000, 10000];
    for (const delay of delays) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (run !== submitRunRef.current) return; // 學生按了「再做一次」，這次的送出作廢
      try {
        await submitQuizAnswer(payload);
        if (run !== submitRunRef.current) return;
        setSubmitStatus('sent');
        clearQuizProgress(payload.quizId);
        clearSubmitId(payload.quizId);
        return;
      } catch (err: any) {
        console.warn('submitQuizAnswer failed:', err?.status, err?.message);
        // 測驗已過期或被刪除：重送也沒用
        if (err?.status === 404) {
          if (run === submitRunRef.current) setSubmitStatus('expired');
          return;
        }
      }
    }
    if (run === submitRunRef.current) setSubmitStatus('failed');
  };

  const handleFinishQuiz = () => {
    processAndSetResults();
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setPreviousQuestionIndex(null);
    setSelectedAnswers(Array(questionsOutput.questions.length).fill(null));
    setQuizResults(null);
    setQuizState('answering');
    setIsCurrentQuestionAnswered(false);
    setEndedEarly(false);
    // 「再做一次」是新的一份作答：作廢還在送的這次、換一個新的交卷編號
    submitRunRef.current++;
    pendingSubmissionRef.current = null;
    setSubmitStatus('none');
    if (quizId) clearSubmitId(quizId);
  };

  // 作答中按「退出測驗」：學生頁先跳確認視窗；老師預覽維持直接離開
  const handleExitWhileAnswering = () => {
    if (endScreen) setIsExitConfirmOpen(true);
    else onExitQuiz();
  };

  const confirmEarlyExit = () => {
    setIsExitConfirmOpen(false);
    setEndedEarly(true);
    processAndSetResults('ended');
  };

  // 看完結果按「退出測驗」：作答已送出，直接進結束畫面
  const handleExitFromResults = () => {
    if (endScreen) setQuizState('ended');
    else onExitQuiz();
  };

  // 進入結束畫面時回到頁面最上方，讓學生先看到「測驗已結束」
  useEffect(() => {
    if (quizState === 'ended') {
      onExitQuiz();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizState]);

  const handleShareResultsPdf = async () => {
    if (!quizResults) {
      toast({ title: "錯誤", description: "沒有測驗結果可供分享。", variant: "destructive" });
      return;
    }
    setIsSharingPdfInternal(true);
    showFileGenerationProgress(true);
    try {
      await exportQuizResultsToPDF(
        quizResults,
        imagePreviews,
        inputText,
        studentInfo,
        toast,
        updateFileGenerationProgress
      );
    } catch (error: any) {
      toast({
        title: "分享結果失敗",
        description: `無法產生結果 PDF: ${error.message || '未知錯誤'}`,
        variant: "destructive",
      });
      updateFileGenerationProgress(0, `結果 PDF 產生失敗: ${error.message || '未知錯誤'}`);
    } finally {
      setIsSharingPdfInternal(false);
      showFileGenerationProgress(false);
    }
  };

  const currentSelectedValue = selectedAnswers[currentQuestionIndex] !== null
    ? selectedAnswers[currentQuestionIndex]?.toString()
    : undefined;

  const getAnimationClass = () => {
    if (previousQuestionIndex === null || previousQuestionIndex === currentQuestionIndex) {
      return "animate-in fade-in-25 duration-300";
    }
    if (currentQuestionIndex > previousQuestionIndex) {
      return "animate-in slide-in-from-right-8 fade-in-0 duration-300";
    }
    if (currentQuestionIndex < previousQuestionIndex) {
      return "animate-in slide-in-from-left-8 fade-in-0 duration-300";
    }
    return "";
  };


  if (quizState === 'ended' && quizResults) {
    return (
      <QuizEndScreen
        results={quizResults}
        levels={pirlsLevelDetails}
        studentInfo={studentInfo}
        quizTitle={questionsOutput.title}
        endedEarly={endedEarly}
        submitStatus={submitStatus}
        onRetrySubmit={() => void sendSubmission()}
        onRestart={handleRestartQuiz}
        onDownloadPdf={handleShareResultsPdf}
        isPdfBusy={isSharingPdfInternal || isGeneratingQuizResultsPdf}
      />
    );
  }

  if (quizState === 'results' && quizResults) {
    const totalQuestions = quizResults.length;
    const totalCorrect = quizResults.filter(r => r.isCorrect).length;
    const overallScore = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    const pirlsScores: Record<string, { correct: number, total: number, label: string }> = {};
    (Object.keys(pirlsLevelDetails) as Array<PirlsQuestion['pirlsLevel']>).forEach(levelKey => {
        pirlsScores[levelKey] = {
            correct: 0,
            total: 0,
            label: pirlsLevelDetails[levelKey].label
        };
    });

    quizResults.forEach(result => {
      if (pirlsScores[result.pirlsLevel]) {
        pirlsScores[result.pirlsLevel].total++;
        if (result.isCorrect) {
          pirlsScores[result.pirlsLevel].correct++;
        }
      }
    });

    return (
      <Card
        ref={quizResultsTopRef}
        className="w-full border-neo shadow-neo-lg rounded-[24px] animate-in fade-in-50 slide-in-from-bottom-8 duration-500"
      >
        <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center">
            <CheckSquare className="h-7 w-7 mr-3 text-primary" />
            <CardTitle>測驗結果</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
            <Button
              variant="outline"
              onClick={handleShareResultsPdf}
              disabled={isSharingPdfInternal || isGeneratingQuizResultsPdf}
            >
              {isSharingPdfInternal || isGeneratingQuizResultsPdf ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  結果PDF準備中...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  分享結果 (PDF)
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleRestartQuiz} disabled={isSharingPdfInternal || isGeneratingQuizResultsPdf}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重新測驗
            </Button>
            <Button variant="ghost" onClick={handleExitFromResults} disabled={isSharingPdfInternal || isGeneratingQuizResultsPdf}>
              <LogOut className="mr-2 h-4 w-4" />
              退出測驗
            </Button>
          </div>
        </CardHeader>
        {endScreen && submitStatus !== 'none' && (
          <div className="px-6 pb-2">
            <SubmitStatusBox status={submitStatus} onRetry={() => void sendSubmission()} />
          </div>
        )}
        <CardContent className="space-y-6">
           {studentInfo && (
            <Card className="mb-4 bg-muted/50 dark:bg-muted/20">
              <CardHeader>
                <CardTitle className="text-lg">學生資訊</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>班級：</strong> {studentInfo.class}</p>
                <p><strong>座號：</strong> {studentInfo.seatNumber}</p>
                <p><strong>姓名：</strong> {studentInfo.name}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">總體表現</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>您答對了 {totalCorrect} / {totalQuestions} 題。</p>
              <Progress value={overallScore} className="w-full h-3" />
              <p className="text-sm text-muted-foreground text-center">{Math.round(overallScore)}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">各PIRLS層次得分</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(pirlsScores).map(([level, score]) => {
                if (score.total === 0 && !questionsOutput.questions.some(q => q.pirlsLevel === level)) return null;
                const percentage = score.total > 0 ? (score.correct / score.total) * 100 : 0;
                const levelInfo = pirlsLevelDetails[level as PirlsQuestion['pirlsLevel']];
                if (!levelInfo) return null;
                const levelBadgeVariant = levelInfo.badgeVariant;
                return (
                  <div key={level}>
                    <div className="flex justify-between items-center mb-1">
                      <Badge variant={levelBadgeVariant} className="text-xs">{score.label}</Badge>
                      <span className="font-medium">{score.correct} / {score.total} 題</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div>
            <h3 className="text-lg font-semibold mb-3 mt-6">題目詳解：</h3>
            <Accordion type="multiple" className="w-full space-y-2">
              {quizResults.map((result, index) => (
                <AccordionItem value={`result-${index}`} key={`result-${index}`} className={cn(
                  "border rounded-md shadow-sm",
                  result.isCorrect ? "border-green-300 bg-green-500/5 hover:bg-green-500/10 dark:border-green-700 dark:bg-green-900/20 dark:hover:bg-green-800/20"
                                  : "border-destructive/30 bg-destructive/5 hover:bg-destructive/10 dark:border-destructive/50 dark:bg-destructive/20 dark:hover:bg-destructive/30"
                )}>
                  <AccordionTrigger className="px-4 py-3 text-left hover:no-underline group">
                    <div className="flex items-center w-full">
                      <span className={`mr-3 font-semibold ${result.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-destructive dark:text-red-400'}`}>
                        題目 {index + 1}: {result.isCorrect ? <CheckCircle className="inline h-5 w-5 ml-1" /> : <XCircle className="inline h-5 w-5 ml-1" />}
                      </span>
                      <span className="flex-1 text-sm group-hover:text-primary">{result.questionText}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2 space-y-3 text-sm">
                    <p><strong>您的答案：</strong>
                      <span className={cn(result.userAnswerIndex === null || result.isCorrect ? "text-foreground" : "text-destructive line-through dark:text-red-400")}>
                        {result.userAnswerIndex !== null
                          ? `${optionLabels[result.userAnswerIndex]}. ${result.options[result.userAnswerIndex]}`
                          : <span className="text-muted-foreground italic">未作答</span>}
                      </span>
                    </p>
                    {!result.isCorrect && (
                        <p><strong>正確答案：</strong>
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {optionLabels[result.correctAnswerIndex]}. {result.options[result.correctAnswerIndex]}
                          </span>
                        </p>
                    )}
                    {result.explanation && (
                      <div className="mt-2">
                        <p className="font-semibold text-sm text-muted-foreground mb-1">答後講解：</p>
                        <CardDescription className="text-sm leading-relaxed whitespace-pre-wrap p-3 bg-muted/60 dark:bg-muted/30 rounded-md border border-dashed">
                          {result.explanation}
                        </CardDescription>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quizState === 'answering' && !currentQuestion) {
    return (
      <Card className="w-full shadow-xl flex items-center justify-center p-8">
        <CardContent>
          <p>載入題目中...</p>
        </CardContent>
      </Card>
    );
  }

  // Main 'answering' state rendering
  if (quizState === 'answering' && currentQuestion) {
    const hasImages = imagePreviews.length > 0;
    const hasText = inputText && inputText.trim().length > 0;
    const isAnswerCorrect = selectedAnswers[currentQuestionIndex] === currentQuestion.correctAnswerIndex;

    return (
      <Dialog
        open={isQuizImageDialogOpen}
        onOpenChange={(isOpen) => {
            if (!isOpen) {
                setSelectedQuizImageForDialog(null);
                setDialogQuizImageScale(1);
                setQuizImageOffset({ x: 0, y: 0 });
                setIsQuizImagePanning(false);
            }
            setIsQuizImageDialogOpen(isOpen);
        }}
      >
        <Card className={cn("w-full border-neo shadow-neo-lg rounded-[24px]", "animate-in fade-in-25 zoom-in-95 duration-500")}>
          <CardHeader className="flex flex-row justify-between items-center pb-4">
            <div className="flex items-center">
              <BookOpen className="h-6 w-6 mr-2 text-primary" />
              <CardTitle>PIRLS 線上測驗</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleExitWhileAnswering} className="ml-auto">
              <LogOut className="mr-2 h-4 w-4" />
              退出測驗
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
             {(hasImages || hasText) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2 text-muted-foreground">閱讀文本：</h3>
                <ScrollArea className="h-[200px] sm:h-[300px] w-full rounded-md border p-4 bg-muted/30 dark:bg-muted/10">
                  {hasImages ? (
                    <div className="space-y-4">
                      {imagePreviews.map((src, index) => (
                        <DialogTrigger asChild key={index}>
                          <div
                              className="relative aspect-auto cursor-pointer mb-4"
                              onClick={() => handleQuizImageClick(src)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleQuizImageClick(src); } }}
                              tabIndex={0}
                              role="button"
                              aria-label={`放大檢視閱讀圖片 ${index + 1}`}
                            >
                            <Image
                              src={src}
                              alt={`閱讀圖片 ${index + 1}`}
                              width={800}
                              height={600}
                              className="w-full h-auto rounded-md object-contain"
                              data-ai-hint="document scan"
                            />
                          </div>
                        </DialogTrigger>
                      ))}
                    </div>
                  ) : hasText ? (
                    <p className="text-base whitespace-pre-wrap">{inputText}</p>
                  ) : null}
                  <ScrollBar orientation="vertical" />
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            )}
            <Separator />

            <div
              key={currentQuestionIndex}
              className={cn("mt-6", getAnimationClass())}
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-lg font-semibold">
                  題目 {currentQuestionIndex + 1} / {questionsOutput.questions.length}
                </h4>
                {levelDetail && (
                  <Badge variant={levelDetail.badgeVariant} className={cn("text-xs", levelDetail.borderColorClass)}>
                    {levelDetail.icon && <levelDetail.icon className="h-3 w-3 mr-1.5" />}
                    {levelDetail.label}
                  </Badge>
                )}
              </div>

              <div className="p-4 border rounded-lg bg-muted dark:bg-secondary shadow-md mb-6">
                 <p className="text-lg sm:text-xl font-semibold text-foreground">{currentQuestion.question}</p>
              </div>

              <RadioGroup
                value={currentSelectedValue}
                onValueChange={handleOptionChange}
                className="space-y-2"
                disabled={isCurrentQuestionAnswered}
              >
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswers[currentQuestionIndex] === index;
                  const isCorrect = index === currentQuestion.correctAnswerIndex;
                  return (
                    <div
                      key={index}
                      onClick={() => handleOptionChange(index.toString())}
                      className={cn(
                        "flex items-center space-x-3 p-3 border rounded-md transition-all duration-200",
                        isCurrentQuestionAnswered ? "cursor-default" : "cursor-pointer hover:bg-accent/20 dark:hover:bg-accent/30",
                        isSelected && !isCorrect && isCurrentQuestionAnswered && "bg-destructive/20 border-destructive ring-1 ring-destructive",
                        isCorrect && isCurrentQuestionAnswered && "bg-green-500/20 border-green-600 ring-1 ring-green-600",
                        isSelected && !isCurrentQuestionAnswered && "bg-primary/10 border-primary ring-1 ring-primary dark:bg-primary/20"
                      )}
                    >
                      <RadioGroupItem
                        value={index.toString()}
                        id={`q${currentQuestionIndex}-opt${index}`}
                        disabled={isCurrentQuestionAnswered}
                      />
                      <Label
                        htmlFor={`q${currentQuestionIndex}-opt${index}`}
                        className={cn("flex-1 text-sm", isCurrentQuestionAnswered ? "cursor-default" : "cursor-pointer")}
                      >
                        <span className="font-semibold mr-1.5">{optionLabels[index]}.</span> {option}
                      </Label>
                      {isCurrentQuestionAnswered && isCorrect && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {isCurrentQuestionAnswered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-destructive" />}
                    </div>
                  );
                })}
              </RadioGroup>

              {isCurrentQuestionAnswered && (
                <Card className={cn(
                    "mt-4 animate-in fade-in duration-500",
                    isAnswerCorrect ? "bg-green-500/10 border-green-500/50" : "bg-destructive/10 border-destructive/50"
                )}>
                  <CardContent className="p-4 space-y-2">
                    <p className={cn("font-bold text-sm", isAnswerCorrect ? "text-green-700 dark:text-green-300" : "text-destructive dark:text-red-300")}>
                        {isAnswerCorrect ? '恭喜答對！' : `答錯了！正確答案是 ${optionLabels[currentQuestion.correctAnswerIndex]}`}
                    </p>
                    <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap pt-2 border-t border-dashed">
                        <p className="font-semibold flex items-center gap-1"><Sparkles className="h-3 w-3" />答後講解：</p>
                        {currentQuestion.explanation}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col-reverse sm:flex-row justify-between items-center pt-6 space-y-2 sm:space-y-0">
            <Button
              variant="outline"
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              上一題
            </Button>
            {isCurrentQuestionAnswered && (
              currentQuestionIndex === questionsOutput.questions.length - 1 ? (
                <Button
                  onClick={handleFinishQuiz}
                  className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800 animate-bounce-subtle"
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  查看結果
                </Button>
              ) : (
                <Button
                  variant="default"
                  onClick={goToNextQuestion}
                  className="animate-bounce-subtle"
                >
                  下一題
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )
            )}
          </CardFooter>
        </Card>

        <DialogContent
            className="w-[calc(100vw-2rem)] max-w-none sm:w-auto sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl p-2 bg-background/95 backdrop-blur-sm rounded-lg"
        >
            <DialogHeader className="sr-only">
                <DialogTitle>放大的閱讀圖片</DialogTitle>
                <DialogDescription>詳細檢視閱讀文本圖片內容，可使用按鈕或滑鼠滾輪進行縮放，以及拖曳平移圖片。</DialogDescription>
            </DialogHeader>
            {selectedQuizImageForDialog && (
            <div
                ref={quizImageDisplayAreaRef}
                className="relative w-full h-full flex justify-center items-center overflow-hidden"
                onWheel={handleDialogQuizImageWheel}
            >
                <Image
                src={selectedQuizImageForDialog}
                alt="放大的閱讀圖片"
                width={1200}
                height={800}
                style={{
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: 'calc(85vh - 2rem - 40px)',
                    objectFit: 'contain',
                    transform: `scale(${dialogQuizImageScale}) translate(${quizImageOffset.x}px, ${quizImageOffset.y}px)`,
                    cursor: isQuizImagePanning ? 'grabbing' : (dialogQuizImageScale > 1 ? 'grab' : 'default'),
                    transition: isQuizImagePanning ? 'none' : 'transform 0.1s ease-out',
                    userSelect: 'none',
                    touchAction: dialogQuizImageScale > 1 ? 'none' : 'auto',
                }}
                className="rounded-md shadow-xl"
                data-ai-hint="document scan enlarged"
                onMouseDown={handleQuizPanStart}
                onTouchStart={handleQuizPanStart}
                draggable="false"
                />
            </div>
            )}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 sm:bottom-4 sm:gap-2 sm:p-2 bg-background/80 rounded-lg shadow-md">
                <Button variant="outline" size="icon" onClick={zoomOutQuizDialog} aria-label="縮小">
                    <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={resetQuizZoomDialog} aria-label="重設縮放">
                    <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={zoomInQuizDialog} aria-label="放大">
                    <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
            </div>
        </DialogContent>

        <AlertDialog open={isExitConfirmOpen} onOpenChange={setIsExitConfirmOpen}>
          <AlertDialogContent className="border-neo rounded-[20px] shadow-neo-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-extrabold">🏁 確定要結束測驗嗎？</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-base text-ink">
                  <p>
                    你已經作答 <b>{selectedAnswers.filter(a => a !== null).length}</b> / {questionsOutput.questions.length} 題。
                  </p>
                  {selectedAnswers.filter(a => a !== null).length < questionsOutput.questions.length && (
                    <p>
                      還有 <b>{questionsOutput.questions.length - selectedAnswers.filter(a => a !== null).length}</b> 題沒作答，結束後就不能再回來作答，沒作答的題目會算答錯。
                    </p>
                  )}
                  <p className="text-muted-foreground text-sm">結束後會看到你的成績和每一題的回饋。</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="border-neo rounded-full">繼續作答</AlertDialogCancel>
              <AlertDialogAction onClick={confirmEarlyExit} className="border-neo rounded-full bg-coral hover:bg-coral text-white">
                結束測驗，看回饋
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Dialog>
    );
  }

  // Fallback or initial loading state if none of the above conditions are met
  return (
    <Card className="w-full shadow-xl flex items-center justify-center p-8">
      <CardContent><p>載入中或狀態錯誤...</p></CardContent>
    </Card>
  );
}
