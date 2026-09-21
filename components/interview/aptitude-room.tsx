"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AptitudeQuestion } from "@/lib/interview/aptitude-bank";
import { Clock, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Award, HelpCircle } from "lucide-react";

interface AptitudeRoomProps {
  sessionId: string;
  questions: AptitudeQuestion[];
}

export function AptitudeRoom({ sessionId, questions }: AptitudeRoomProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes countdown
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    correctCount: number;
    totalQuestions: number;
    breakdown: Array<{
      id: string;
      category: string;
      question: string;
      selectedOptionIndex: number | null;
      correctOptionIndex: number;
      isCorrect: boolean;
      explanation: string;
    }>;
  } | null>(null);

  // Timer effect
  useEffect(() => {
    if (result || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitAnswers();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [result, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (result) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleSubmitAnswers = async () => {
    if (isSubmitting || result) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/interview/${sessionId}/aptitude/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const data = await res.json();
      if (res.ok && data.data) {
        setResult(data.data);
      }
    } catch (err) {
      console.error("Failed to submit aptitude assessment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  if (result) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <Card className="border-primary/30 shadow-md">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-2">
              <Award className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-bold font-heading">
              Aptitude Assessment Completed
            </CardTitle>
            <CardDescription>
              Here is your objective score breakdown and answer review.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="p-6 rounded-card bg-surface border border-border flex flex-col sm:flex-row items-center justify-around gap-4 text-center">
              <div>
                <p className="text-xs text-text-secondary">Overall Score</p>
                <p className="text-3xl font-bold font-heading text-primary mt-1">
                  {result.score}%
                </p>
              </div>
              <div className="h-8 w-px bg-border hidden sm:block" />
              <div>
                <p className="text-xs text-text-secondary">Correct Answers</p>
                <p className="text-3xl font-bold font-heading text-success mt-1">
                  {result.correctCount} / {result.totalQuestions}
                </p>
              </div>
              <div className="h-8 w-px bg-border hidden sm:block" />
              <div>
                <p className="text-xs text-text-secondary">Accuracy</p>
                <p className="text-3xl font-bold font-heading text-text-primary mt-1">
                  {Math.round((result.correctCount / result.totalQuestions) * 100)}%
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Detailed Question Review
              </h3>
              {result.breakdown.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 rounded-card border border-border bg-surface space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">
                      Question {idx + 1} • {item.category}
                    </span>
                    {item.isCorrect ? (
                      <Badge variant="success" className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Correct
                      </Badge>
                    ) : (
                      <Badge variant="error" className="flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Incorrect
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-text-primary font-medium whitespace-pre-wrap">
                    {item.question}
                  </p>

                  <div className="p-3 rounded-input bg-background border border-border text-xs space-y-1">
                    <p className="font-semibold text-primary">Explanation:</p>
                    <p className="text-text-secondary leading-relaxed">
                      {item.explanation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t border-border pt-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Return to Dashboard
              </Button>
            </Link>
            <Link href="/interview">
              <Button size="sm">
                Start Another Interview
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header & Timer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-card bg-surface border border-border shadow-soft">
        <div className="flex items-center gap-2">
          <Badge variant="primary">Aptitude Round</Badge>
          <span className="text-xs text-text-secondary">
            {answeredCount} of {questions.length} answered
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-sm font-semibold text-text-primary px-3 py-1.5 rounded-input bg-background border border-border">
          <Clock className="w-4 h-4 text-warning" />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Question Card */}
      {currentQ && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
              <span>Question {currentIndex + 1} of {questions.length}</span>
              <Badge variant="neutral">{currentQ.category}</Badge>
            </div>
            <CardTitle className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
              {currentQ.question}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {currentQ.options.map((opt, optIdx) => {
              const isSelected = answers[currentQ.id] === optIdx;
              return (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() => handleSelectOption(currentQ.id, optIdx)}
                  className={`w-full p-3.5 rounded-input border text-left text-sm flex items-center gap-3 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-medium shadow-soft"
                      : "border-border bg-surface hover:border-primary/50 text-text-primary"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${
                      isSelected
                        ? "border-primary bg-primary text-white font-bold"
                        : "border-border text-text-secondary"
                    }`}
                  >
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </CardContent>

          {/* Question Navigator & Actions */}
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))
                }
                disabled={currentIndex === questions.length - 1}
                className="text-xs"
              >
                Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>

            <Button
              onClick={handleSubmitAnswers}
              disabled={isSubmitting}
              className="w-full sm:w-auto text-xs"
            >
              {isSubmitting ? "Scoring Assessment..." : "Submit Test"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Question Jumper Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {questions.map((q, idx) => {
          const isAnswered = answers[q.id] !== undefined;
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={`w-8 h-8 rounded-input text-xs font-semibold transition-colors ${
                isCurrent
                  ? "bg-primary text-white shadow-soft"
                  : isAnswered
                  ? "bg-success/15 border border-success/40 text-success"
                  : "bg-surface border border-border text-text-secondary hover:border-primary"
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
