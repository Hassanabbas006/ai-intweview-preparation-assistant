import * as React from "react";
import { Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  role: "assistant" | "user" | "system";
  content: string;
  isStreaming?: boolean;
}

export function ChatBubble({ role, content, isStreaming }: ChatBubbleProps) {
  const isAI = role === "assistant";

  // Simple paragraph & code block parser
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, idx) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const lines = part.slice(3, -3).trim().split("\n");
        const language = lines[0]?.match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : "";
        const codeContent = language ? lines.slice(1).join("\n") : lines.join("\n");

        return (
          <div key={idx} className="my-2 rounded-input overflow-hidden border border-border bg-background text-xs font-mono">
            {language && (
              <div className="px-3 py-1 bg-surface border-b border-border text-text-secondary text-[11px] font-semibold uppercase">
                {language}
              </div>
            )}
            <pre className="p-3 overflow-x-auto text-text-primary leading-relaxed">
              <code>{codeContent}</code>
            </pre>
          </div>
        );
      }

      // Format bold and linebreaks
      return (
        <div key={idx} className="space-y-2 leading-relaxed whitespace-pre-wrap">
          {part}
        </div>
      );
    });
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 max-w-[88%] sm:max-w-[80%]",
        isAI ? "self-start" : "self-end flex-row-reverse"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-soft",
          isAI
            ? "bg-primary text-white"
            : "bg-surface border border-border text-text-primary"
        )}
      >
        {isAI ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>

      <div
        className={cn(
          "p-4 rounded-2xl shadow-soft text-sm transition-colors",
          isAI
            ? "rounded-tl-sm bg-primary/10 border border-primary/20 text-text-primary"
            : "rounded-tr-sm bg-surface border border-border text-text-primary"
        )}
      >
        <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-border/40">
          <span className="text-[11px] font-semibold text-text-secondary">
            {isAI ? "AI Interviewer" : "You (Candidate)"}
          </span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-primary animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Live
            </span>
          )}
        </div>

        <div className="text-text-primary text-sm leading-relaxed">
          {renderFormattedText(content)}
        </div>
      </div>
    </div>
  );
}
