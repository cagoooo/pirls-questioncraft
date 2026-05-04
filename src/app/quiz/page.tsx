// src/app/quiz/page.tsx
// 路線 B：原本動態路由 /quiz/[quizId] 改成 /quiz?id=xxx 的 query string 版本，
// 因為 GitHub Pages 純靜態主機不支援動態路由 deep link。
"use client";

import React, { useEffect, useState, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuizView } from '@/components/QuizView';
import type { GeneratePirlsQuestionsOutput } from '@/lib/api';
import { Loader2, AlertCircle, BookOpen, Users, Hash, User, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PirlsLogo } from '@/components/PirlsLogo';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { getSharedQuiz } from '@/lib/api';

interface QuizData {
  questionsOutput: GeneratePirlsQuestionsOutput;
  imageFilesDataURIs: string[];
  inputText?: string;
}

export interface StudentInfo {
  class: string;
  seatNumber: string;
  name: string;
}

type ProgressCallback = (progress: number, message: string) => void;

function SharedQuizPageInner() {
  const searchParams = useSearchParams();
  const quizId = searchParams?.get('id') ?? undefined;

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [studentClass, setStudentClass] = useState('');
  const [studentSeatNumber, setStudentSeatNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isStudentInfoSubmitted, setIsStudentInfoSubmitted] = useState(false);

  // 從 localStorage 還原上次的班級（座號/姓名不記，同 iPad 給不同學生用避免誤帶）
  useEffect(() => {
    try {
      const lastClass = localStorage.getItem('pirls_last_class');
      if (lastClass) setStudentClass(lastClass);
    } catch { /* localStorage 不可用就略過 */ }
  }, []);
  const [formError, setFormError] = useState<string | null>(null);

  const [isGeneratingQuizResultsPdf, setIsGeneratingQuizResultsPdf] = useState(false);
  const [fileGenerationProgress, setFileGenerationProgress] = useState(0);
  const [fileGenerationMessage, setFileGenerationMessage] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    if (!quizId) {
      setError('無效的測驗連結（缺少 id 參數）。');
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      setQuizData(null);
      try {
        const data = await getSharedQuiz(quizId);
        if (cancelled) return;
        setQuizData(data);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? '無法載入測驗，連結可能已失效或不存在。');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const handleStudentInfoSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!studentClass.trim() || !studentSeatNumber.trim() || !studentName.trim()) {
      setFormError('請填寫所有欄位：班級、座號、姓名。');
      toast({
        title: '資訊未完整',
        description: '請填寫所有欄位：班級、座號、姓名。',
        variant: 'destructive',
      });
      return;
    }
    // 把班級存起來，下次同班同學進來自動帶（座號/姓名不存）
    try { localStorage.setItem('pirls_last_class', studentClass.trim()); } catch { /* ignore */ }
    setIsStudentInfoSubmitted(true);
  };

  const handleShowQuizResultsPdfProgress = (show: boolean) => {
    setIsGeneratingQuizResultsPdf(show);
  };

  const handleUpdateQuizResultsPdfProgress: ProgressCallback = (progress, message) => {
    setFileGenerationProgress(progress);
    setFileGenerationMessage(message);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-semibold">載入測驗中...</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4 py-8">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-muted-foreground">請稍候，正在為您準備測驗內容。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-semibold text-destructive">載入失敗</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>錯誤</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <Link href="/">返回首頁</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quizData && !isStudentInfoSubmitted) {
    const quizTitle = quizData.questionsOutput?.title;
    const questionCount = quizData.questionsOutput?.questions?.length ?? 0;
    const hadRememberedClass = !!studentClass; // 進畫面前已從 localStorage 還原 → true

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <PirlsLogo className="mx-auto mb-4 h-20 w-auto sm:h-24" />
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-3">
            {/* 測驗標題預覽：讓學生知道進入哪份測驗 */}
            {quizTitle && (
              <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
                <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-primary/70">即將進行</p>
                  <p className="font-bold text-primary truncate">{quizTitle}</p>
                  {questionCount > 0 && (
                    <p className="text-xs text-muted-foreground">共 {questionCount} 題</p>
                  )}
                </div>
              </div>
            )}
            <CardTitle className="text-center text-lg sm:text-xl font-bold">
              請填寫你的身分資訊
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStudentInfoSubmit} className="space-y-4">
              {/* 班級 */}
              <div className="space-y-1.5">
                <Label htmlFor="studentClass" className="text-sm flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  班級
                  {hadRememberedClass && (
                    <span className="ml-auto text-[10px] text-green-600 font-normal">✓ 已記住上次的班級</span>
                  )}
                </Label>
                <Input
                  id="studentClass"
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  placeholder="例如：三年一班"
                  className="text-sm sm:text-base"
                  autoFocus={!hadRememberedClass}
                  required
                />
              </div>

              {/* 座號 + 姓名 同列（手機 sm 以下仍兩列堆疊） */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="studentSeatNumber" className="text-sm flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    座號
                  </Label>
                  <Input
                    id="studentSeatNumber"
                    value={studentSeatNumber}
                    onChange={(e) => setStudentSeatNumber(e.target.value)}
                    placeholder="01"
                    className="text-sm sm:text-base text-center tabular-nums"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    autoFocus={hadRememberedClass}
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="studentName" className="text-sm flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    姓名
                  </Label>
                  <Input
                    id="studentName"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="例如：王小明"
                    className="text-sm sm:text-base"
                    required
                  />
                </div>
              </div>

              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>輸入錯誤</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full py-2 sm:py-3 text-base sm:text-lg group">
                開始測驗
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                提示：你的姓名與分數會給老師看，不會公開
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quizData && isStudentInfoSubmitted) {
    const studentInfo: StudentInfo = {
      class: studentClass,
      seatNumber: studentSeatNumber,
      name: studentName,
    };
    return (
      <div className="container mx-auto p-4 sm:p-8 min-h-screen flex flex-col items-center">
        <header className="my-4 sm:my-8 text-center w-full max-w-3xl">
          <PirlsLogo className="mx-auto mb-4 h-12 w-auto sm:h-16" />
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary">PIRLS 線上測驗</h1>
          {/* 學生身分卡：班級 / 座號 / 姓名 三欄式分類，一眼可辨識 */}
          <div className="mt-3 inline-flex items-stretch rounded-lg border bg-muted/40 overflow-hidden text-sm shadow-sm">
            <div className="px-3 py-1.5 flex items-center gap-1.5 border-r">
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">班級</span>
              <span className="font-bold text-foreground">{studentInfo.class}</span>
            </div>
            <div className="px-3 py-1.5 flex items-center gap-1.5 border-r">
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">座號</span>
              <span className="font-bold text-foreground tabular-nums">{studentInfo.seatNumber}</span>
            </div>
            <div className="px-3 py-1.5 flex items-center gap-1.5 bg-primary/10">
              <span className="text-[10px] sm:text-xs text-primary/70 uppercase tracking-wider">姓名</span>
              <span className="font-bold text-primary">{studentInfo.name}</span>
            </div>
          </div>
        </header>
        <main className="w-full max-w-3xl">
          {isGeneratingQuizResultsPdf && (
            <Card className="w-full shadow-md mb-6">
              <CardHeader>
                <CardTitle className="flex items-center text-lg sm:text-xl font-semibold">
                  <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" />
                  結果PDF處理中...
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <Progress value={fileGenerationProgress} className="w-full h-3" />
                <p className="text-xs sm:text-sm text-muted-foreground text-center">
                  {fileGenerationMessage} ({Math.round(fileGenerationProgress)}%)
                </p>
              </CardContent>
            </Card>
          )}
          <QuizView
            questionsOutput={quizData.questionsOutput}
            imageFiles={[]}
            imageFilesDataURIs={quizData.imageFilesDataURIs}
            inputText={quizData.inputText}
            studentInfo={studentInfo}
            quizId={quizId}
            onExitQuiz={() => {
              toast({ title: '測驗已結束', description: '感謝您的參與！您可以關閉此頁面。' });
            }}
            toast={toast}
            showFileGenerationProgress={handleShowQuizResultsPdfProgress}
            updateFileGenerationProgress={handleUpdateQuizResultsPdfProgress}
            isGeneratingQuizResultsPdf={isGeneratingQuizResultsPdf}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <p className="text-muted-foreground mb-4">無法載入測驗內容，請確認連結是否正確或稍後再試。</p>
      <Button asChild className="mt-4">
        <Link href="/">返回首頁</Link>
      </Button>
    </div>
  );
}

export default function SharedQuizPage() {
  // useSearchParams 在 static export 必須包 Suspense
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
      }
    >
      <SharedQuizPageInner />
    </Suspense>
  );
}
