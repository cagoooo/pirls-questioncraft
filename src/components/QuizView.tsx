
// src/components/QuizView.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, XCircle, BookOpen, CheckCircle, AlertTriangle, CheckSquare, RotateCcw, LogOut } from 'lucide-react';
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

type PirlsQuestion = GeneratePirlsQuestionsOutput['questions'][0];

interface QuizViewProps {
  questionsOutput: GeneratePirlsQuestionsOutput;
  imageFiles: File[];
  onExitQuiz: () => void;
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

type QuizState = 'answering' | 'results';

export function QuizView({ questionsOutput, imageFiles, onExitQuiz }: QuizViewProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>(() =>
    Array(questionsOutput.questions.length).fill(null)
  );
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [quizState, setQuizState] = useState<QuizState>('answering');
  const [quizResults, setQuizResults] = useState<QuizResultItem[] | null>(null);

  const currentQuestion = useMemo(() => questionsOutput.questions[currentQuestionIndex], [questionsOutput, currentQuestionIndex]);
  
  const levelDetail = useMemo(() => {
    if (quizState === 'answering' && currentQuestion) {
      return pirlsLevelDetails[currentQuestion.pirlsLevel];
    }
    return null;
  }, [currentQuestion, quizState]);


  useEffect(() => {
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

    if (imageFiles.length > 0) {
      generatePreviews();
    }
    
    // Cleanup function
    return () => {
      imagePreviews.forEach(url => {
        // Check if the URL is an object URL before revoking
        if (url.startsWith('blob:') || url.startsWith('data:')) {
          // It's a data URI or blob URI, no need to revoke for data URIs,
          // and blob URIs are typically revoked when no longer needed elsewhere if created by URL.createObjectURL
          // For this component's lifecycle, if they were created by URL.createObjectURL and stored,
          // they would need explicit revocation. FileReader's result (data URI) doesn't need this.
        } else {
           // If it were an object URL from URL.createObjectURL, you'd revoke it:
           // URL.revokeObjectURL(url);
        }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFiles]); // imagePreviews should not be in dependency array if we're cleaning it up

  const handleOptionChange = (value: string) => {
    if (quizState !== 'answering') return;
    const answerIndex = parseInt(value, 10);
    setSelectedAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestionIndex] = answerIndex;
      return newAnswers;
    });
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questionsOutput.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1); // Corrected: was prev + 1
    }
  };

  const processAndSetResults = () => {
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
    setQuizState('results');
  };

  const handleFinishQuiz = () => {
    processAndSetResults();
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers(Array(questionsOutput.questions.length).fill(null));
    setQuizResults(null);
    setQuizState('answering');
  };

  const currentSelectedValue = selectedAnswers[currentQuestionIndex] !== null
    ? selectedAnswers[currentQuestionIndex]?.toString()
    : undefined;


  if (quizState === 'results' && quizResults) {
    const totalQuestions = quizResults.length;
    const totalCorrect = quizResults.filter(r => r.isCorrect).length;
    const overallScore = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    const pirlsScores: Record<string, { correct: number, total: number, label: string }> = {};
    // Initialize pirlsScores based on all possible levels to ensure correct order and labels
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
      <Card className="w-full shadow-xl">
        <CardHeader className="flex flex-row justify-between items-center">
          <div className="flex items-center">
            <CheckSquare className="h-7 w-7 mr-3 text-primary" />
            <CardTitle>測驗結果</CardTitle>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleRestartQuiz}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重新測驗
            </Button>
            <Button variant="ghost" onClick={onExitQuiz}>
              <LogOut className="mr-2 h-4 w-4" />
              退出測驗
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
                if (!levelInfo) return null; // Should not happen if keys are aligned
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
                  result.isCorrect ? "border-green-300 bg-green-500/5 hover:bg-green-500/10" : "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                )}>
                  <AccordionTrigger className="px-4 py-3 text-left hover:no-underline group">
                    <div className="flex items-center w-full">
                      <span className={`mr-3 font-semibold ${result.isCorrect ? 'text-green-600' : 'text-destructive'}`}>
                        題目 {index + 1}: {result.isCorrect ? <CheckCircle className="inline h-5 w-5 ml-1" /> : <XCircle className="inline h-5 w-5 ml-1" />}
                      </span>
                      <span className="flex-1 truncate text-sm group-hover:text-primary">{result.questionText}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-2 space-y-3 text-sm">
                    <p><strong>您的答案：</strong>
                      <span className={cn(result.isCorrect ? "" : "text-destructive line-through")}>
                        {result.userAnswerIndex !== null
                          ? `${optionLabels[result.userAnswerIndex]}. ${result.options[result.userAnswerIndex]}`
                          : <span className="text-muted-foreground italic">未作答</span>}
                      </span>
                    </p>
                     {result.isCorrect && (
                       <p className="text-green-600 font-medium flex items-center">
                         <CheckCircle className="h-4 w-4 mr-2" /> 恭喜答對！
                       </p>
                     )}
                    {!result.isCorrect && result.explanation && (
                      <div className="mt-2">
                        <p className="font-semibold text-xs text-muted-foreground mb-1">解題引導：</p>
                        <CardDescription className="text-xs whitespace-pre-wrap p-3 bg-muted/60 dark:bg-muted/30 rounded-md border border-dashed">
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

  // Fallback for 'answering' state if currentQuestion is not yet ready (defensive)
  if (quizState === 'answering' && !currentQuestion) {
    return (
      <Card className="w-full shadow-xl flex items-center justify-center p-8">
        <CardContent>
          <p>載入題目中...</p> {/* Or a spinner component */}
        </CardContent>
      </Card>
    );
  }

  // 'answering' state UI
  return (
    <Card className="w-full shadow-xl">
      <CardHeader className="flex flex-row justify-between items-center pb-4">
        <div className="flex items-center">
          <BookOpen className="h-6 w-6 mr-2 text-primary" />
          <CardTitle>PIRLS 線上測驗</CardTitle>
        </div>
        <Button variant="ghost" size="sm" onClick={onExitQuiz} className="ml-auto">
          <LogOut className="mr-2 h-4 w-4" />
          退出測驗
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {imagePreviews.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-muted-foreground">閱讀文本：</h3>
            <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/30">
              <div className="space-y-4">
                {imagePreviews.map((src, index) => (
                  <Image
                    key={src} 
                    src={src}
                    alt={`閱讀圖片 ${index + 1}`}
                    width={800}
                    height={600}
                    className="w-full h-auto rounded-md object-contain"
                    data-ai-hint="document scan"
                  />
                ))}
              </div>
              <ScrollBar orientation="vertical" />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
        <Separator />

        <div className="mt-6">
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
          <p className="text-md mb-4 min-h-[60px]">{currentQuestion.question}</p>

          <RadioGroup
            value={currentSelectedValue}
            onValueChange={handleOptionChange}
            className="space-y-2"
          >
            {currentQuestion.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 transition-colors">
                <RadioGroupItem value={index.toString()} id={`q${currentQuestionIndex}-opt${index}`} />
                <Label htmlFor={`q${currentQuestionIndex}-opt${index}`} className="flex-1 cursor-pointer text-sm">
                  <span className="font-semibold mr-1">{optionLabels[index]}.</span> {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-6 space-y-2 sm:space-y-0">
        <Button 
          variant="outline" 
          onClick={goToPreviousQuestion} 
          disabled={currentQuestionIndex === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          上一題
        </Button>
        {currentQuestionIndex === questionsOutput.questions.length - 1 ? (
          <Button 
            onClick={handleFinishQuiz}
            className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800"
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            完成測驗
          </Button>
        ) : (
          <Button 
            variant="default" 
            onClick={goToNextQuestion}
            disabled={currentQuestionIndex === questionsOutput.questions.length - 1}
          >
            下一題
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

