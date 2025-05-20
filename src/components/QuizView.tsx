
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
import { ArrowLeft, ArrowRight, XCircle, BookOpen, CheckCircle, AlertTriangle } from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

export function QuizView({ questionsOutput, imageFiles, onExitQuiz }: QuizViewProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>(() => 
    Array(questionsOutput.questions.length).fill(null)
  );
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const currentQuestion = questionsOutput.questions[currentQuestionIndex];
  const levelDetail = pirlsLevelDetails[currentQuestion.pirlsLevel];

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
    
    // Cleanup
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFiles]); // Only re-run if imageFiles change

  const handleOptionChange = (value: string) => {
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
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleFinishQuiz = () => {
    // For now, just log the answers. Scoring will be a future step.
    console.log("Quiz Finished. User Answers:", selectedAnswers);
    // Example of checking answers:
    const results = questionsOutput.questions.map((q, idx) => ({
      question: q.question,
      userAnswer: selectedAnswers[idx] !== null ? optionLabels[selectedAnswers[idx]!] : '未作答',
      correctAnswer: optionLabels[q.correctAnswerIndex],
      isCorrect: selectedAnswers[idx] === q.correctAnswerIndex
    }));
    console.log("Detailed Results:", results);
    // alert("測驗已完成！詳細結果請查看瀏覽器控制台。\n計分與回饋功能將在後續版本加入。");
    // For now, just exit quiz after "finishing"
    onExitQuiz(); 
  };
  
  const currentSelectedValue = selectedAnswers[currentQuestionIndex] !== null 
    ? selectedAnswers[currentQuestionIndex]?.toString() 
    : undefined;

  return (
    <Card className="w-full shadow-xl">
      <CardHeader className="flex flex-row justify-between items-center pb-4">
        <div className="flex items-center">
          <BookOpen className="h-6 w-6 mr-2 text-primary" />
          <CardTitle>PIRLS 線上測驗</CardTitle>
        </div>
        <Button variant="outline" size="sm" onClick={onExitQuiz} className="ml-auto">
          <XCircle className="mr-2 h-4 w-4" />
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
                    key={index}
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
            <Badge variant={levelDetail.badgeVariant} className={cn("text-xs", levelDetail.borderColorClass)}>
              {levelDetail.icon && <levelDetail.icon className="h-3 w-3 mr-1.5" />}
              {levelDetail.label}
            </Badge>
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
            <CheckCircle className="mr-2 h-4 w-4" />
            完成測驗
          </Button>
        ) : (
          <Button 
            variant="outline" 
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
