"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatBubble } from "@/components/interview/chat-bubble";
import { ChatInput } from "@/components/interview/chat-input";
import { TypingIndicator } from "@/components/interview/typing-indicator";
import { EndDialog } from "@/components/interview/end-dialog";
import { AptitudeRoom } from "@/components/interview/aptitude-room";
import { APTITUDE_QUESTION_BANK } from "@/lib/interview/aptitude-bank";
import { getDomainLabel } from "@/lib/constants/domains";
import {
  ArrowLeft,
  Sparkles,
  Clock,
  LogOut,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface MessageItem {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  createdAt: string;
}

interface SessionData {
  id: string;
  type: "HR" | "DOMAIN" | "MANAGERIAL" | "APTITUDE";
  domain?: string | null;
  focusArea?: string | null;
  difficulty?: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  messages: MessageItem[];
}

export default function InterviewSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const [llmMeta, setLlmMeta] = useState<{ provider: string; model: string } | null>(null);

  // Elapsed timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Dialog state
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasTriggeredOpeningRef = useRef(false);

  // Auto-scroll helper
  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll whenever messages change or tokens stream in
  useEffect(() => {
    scrollToBottom(isStreaming ? "auto" : "smooth");
  }, [messages, streamingText, isWaitingForFirstToken, isStreaming, scrollToBottom]);
  const triggerOpeningStream = React.useCallback(async (targetSessionId: string) => {
    if (hasTriggeredOpeningRef.current) return;
    hasTriggeredOpeningRef.current = true;

    setIsWaitingForFirstToken(true);
    setIsStreaming(true);
    setStreamingText("");

    try {
      const response = await fetch(`/api/interview/${targetSessionId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpening: true }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to initiate opening interview stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentAccumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        const lines = rawChunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "meta") {
                setLlmMeta({ provider: data.provider, model: data.model });
              } else if (data.type === "token" && data.content) {
                setIsWaitingForFirstToken(false);
                currentAccumulated += data.content;
                setStreamingText(currentAccumulated);
              } else if (data.type === "done") {
                const openingMsg: MessageItem = {
                  id: data.messageId || `msg_opening_${Date.now()}`,
                  role: "assistant",
                  content: currentAccumulated.trim(),
                  createdAt: new Date().toISOString(),
                };
                setMessages([openingMsg]);
                setStreamingText("");
                setIsStreaming(false);
                setIsWaitingForFirstToken(false);
              } else if (data.type === "error") {
                setError(data.message || "Failed to stream opening question.");
                setIsStreaming(false);
                setIsWaitingForFirstToken(false);
              }
            } catch {
              // Ignore non-JSON chunk lines
            }
          }
        }
      }
    } catch (err: any) {
      console.error("[Opening Stream Failure]:", err);
      setError("AI Interviewer connection interrupted. Please refresh to start.");
      setIsStreaming(false);
      setIsWaitingForFirstToken(false);
    }
  }, []);

  // Load session data and initiate opening question stream in parallel (Zero-waterfall startup)
  useEffect(() => {
    async function initRoom() {
      if (!sessionId) return;

      // Concurrently fire session metadata retrieval and opening question stream
      const sessionFetchPromise = fetch(`/api/interview/${sessionId}`)
        .then((res) => res.json())
        .catch(() => ({ error: true, message: "Network error while loading session." }));

      // Kick off opening stream immediately in parallel
      triggerOpeningStream(sessionId);

      const data = await sessionFetchPromise;

      if (data.error) {
        setError(data.message || "Failed to load interview session.");
        setLoading(false);
        return;
      }

      const sessionData = data.data?.session as SessionData;
      if (sessionData) {
        setSession(sessionData);
        if (sessionData.messages && sessionData.messages.length > 0) {
          setMessages((prev) => (prev.length === 0 ? sessionData.messages : prev));
        }
      }
      setLoading(false);
    }

    initRoom();
  }, [sessionId, triggerOpeningStream]);

  // Elapsed session timer
  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS") return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const formatElapsed = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Send message & handle token-by-token streaming
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isStreaming || !session) return;

    setError(null);

    // Optimistically add user message to UI
    const tempUserMsg: MessageItem = {
      id: `temp_user_${Date.now()}`,
      role: "user",
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsWaitingForFirstToken(true);
    setIsStreaming(true);
    setStreamingText("");

    try {
      const response = await fetch(`/api/interview/${sessionId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to AI streaming service.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentAccumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        const lines = rawChunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "meta") {
                setLlmMeta({ provider: data.provider, model: data.model });
              } else if (data.type === "token" && data.content) {
                setIsWaitingForFirstToken(false);
                currentAccumulated += data.content;
                setStreamingText(currentAccumulated);
              } else if (data.type === "done") {
                const finalAssistantMsg: MessageItem = {
                  id: data.messageId || `msg_${Date.now()}`,
                  role: "assistant",
                  content: currentAccumulated.trim(),
                  createdAt: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, finalAssistantMsg]);
                setStreamingText("");
                setIsStreaming(false);
                setIsWaitingForFirstToken(false);
              } else if (data.type === "error") {
                setError(data.message || "An error occurred during response generation.");
                setIsStreaming(false);
                setIsWaitingForFirstToken(false);
              }
            } catch {
              // Ignore non-JSON or partial chunk lines
            }
          }
        }
      }
    } catch (err: any) {
      console.error("[Streaming Failure]:", err);
      setError("Connection to AI interviewer interrupted. Please retry sending your response.");
      setIsStreaming(false);
      setIsWaitingForFirstToken(false);
    }
  };

  // End interview session
  const handleEndInterview = async () => {
    setIsEndingSession(true);
    try {
      const res = await fetch(`/api/interview/${sessionId}/end`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setShowEndDialog(false);
        setSession((prev) => (prev ? { ...prev, status: "COMPLETED" } : null));
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to end session:", err);
    } finally {
      setIsEndingSession(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="flex items-center gap-3 text-text-secondary">
          <Sparkles className="w-5 h-5 text-primary animate-spin-slow" />
          <span className="text-sm font-medium">Entering Interview Room...</span>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full p-6 rounded-2xl bg-surface border border-border text-center space-y-4 shadow-soft">
          <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold font-heading text-text-primary">Interview Session Unavailable</h2>
          <p className="text-xs text-text-secondary leading-relaxed">{error}</p>
          <Link href="/interview">
            <Button size="sm" className="w-full">
              Back to Interview Hub
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (session?.type === "APTITUDE") {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8 transition-colors">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <Link
              href="/interview"
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Exit Test
            </Link>
            <ThemeToggle />
          </div>
          <AptitudeRoom sessionId={sessionId} questions={APTITUDE_QUESTION_BANK} />
        </div>
      </div>
    );
  }

  const isCompleted = session?.status === "COMPLETED";

  return (
    <div className="min-h-screen flex flex-col bg-background text-text-primary transition-colors">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/interview"
              className="text-text-secondary hover:text-primary transition-colors p-1.5 rounded-input hover:bg-background"
              title="Return to Interview Setup"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm text-text-primary">
                  {session?.type === "HR"
                    ? "HR & Behavioral Interview"
                    : session?.type === "MANAGERIAL"
                    ? "Managerial Leadership Interview"
                    : `${getDomainLabel(session?.domain)} Deep Dive`}
                </span>
                <Badge variant={isCompleted ? "neutral" : "primary"} className="text-[10px]">
                  {isCompleted ? "Completed" : "In Progress"}
                </Badge>
              </div>
              {session?.focusArea && (
                <p className="text-[11px] text-text-secondary mt-0.5 truncate max-w-xs sm:max-w-md">
                  Focus: {session.focusArea}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Live Model Telemetry Badge (Visible only in development/local testing mode to preserve interview immersion for candidates) */}
            {process.env.NODE_ENV !== "production" && llmMeta && (
              <div
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary shadow-soft animate-fade-in"
                title={`[Dev Mode Telemetry] Inference Engine: ${llmMeta.provider.toUpperCase()} (${llmMeta.model})`}
              >
                <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                <span className="font-semibold">
                  {llmMeta.provider === "groq" ? "Groq" : "Gemini"}:
                </span>
                <span className="opacity-90">
                  {llmMeta.model
                    .replace("openai/", "")
                    .replace("gemini-", "")}
                </span>
              </div>
            )}

            {/* Live Session Timer */}
            {!isCompleted && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-background border border-border text-xs font-mono text-text-secondary">
                <Clock className="w-3.5 h-3.5 text-warning" />
                <span>{formatElapsed(elapsedSeconds)}</span>
              </div>
            )}

            <ThemeToggle />

            {!isCompleted ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEndDialog(true)}
                className="text-xs text-error border-error/30 hover:bg-error/10 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">End Round</span>
              </Button>
            ) : (
              <Link href="/dashboard">
                <Button size="sm" className="text-xs">
                  Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Conversation Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col justify-between">
        {/* Chat Stream History Container */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto space-y-5 pb-6 pr-1 custom-scrollbar min-h-[50vh]"
        >
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
            />
          ))}

          {/* Real-time Streaming Bubble */}
          {isStreaming && streamingText && (
            <ChatBubble
              role="assistant"
              content={streamingText}
              isStreaming={true}
            />
          )}

          {/* Typing indicator while waiting for first token */}
          {isWaitingForFirstToken && <TypingIndicator />}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-input bg-error/15 border border-error/30 text-error text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Auto-scroll bottom anchor */}
          <div ref={messagesEndRef} className="h-2 shrink-0" />
        </div>

        {/* Bottom Input Bar */}
        <div className="sticky bottom-4 pt-2">
          {!isCompleted ? (
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={isStreaming}
              placeholder={
                isStreaming
                  ? "AI interviewer is responding..."
                  : "Type your answer or ask a clarifying question..."
              }
            />
          ) : (
            <div className="p-4 rounded-2xl bg-surface border border-border text-center space-y-2 shadow-soft">
              <div className="flex items-center justify-center gap-2 text-success font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" /> This interview round has ended.
              </div>
              <p className="text-xs text-text-secondary">
                Your full interview transcript has been archived. You can review your history or begin a new round.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="text-xs">
                    View Dashboard
                  </Button>
                </Link>
                <Link href="/interview">
                  <Button size="sm" className="text-xs">
                    Start New Interview
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Conclude Session Confirmation Modal */}
      <EndDialog
        isOpen={showEndDialog}
        onClose={() => setShowEndDialog(false)}
        onConfirm={handleEndInterview}
        isEnding={isEndingSession}
      />
    </div>
  );
}
