import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  role: "assistant" | "user" | "system";
  content: string;
  isStreaming?: boolean;
}

export function ChatBubble({ role, content, isStreaming }: ChatBubbleProps) {
  const isAI = role === "assistant";

  return (
    <div
      className={cn(
        "flex items-start gap-3 max-w-[92%] sm:max-w-[85%]",
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
          "p-4 rounded-2xl shadow-soft text-sm transition-colors overflow-hidden",
          isAI
            ? "rounded-tl-sm bg-primary/10 border border-primary/20 text-text-primary"
            : "rounded-tr-sm bg-surface border border-border text-text-primary"
        )}
      >
        <div className="flex items-center justify-between gap-4 mb-2 pb-1 border-b border-border/40">
          <span className="text-[11px] font-semibold text-text-secondary">
            {isAI ? "AI Interviewer" : "You (Candidate)"}
          </span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-primary animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Live
            </span>
          )}
        </div>

        {isAI ? (
          <div className="markdown-content text-sm leading-relaxed space-y-2.5 break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-text-primary">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic">{children}</em>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 my-2 pl-1">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2 pl-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed">{children}</li>
                ),
                h1: ({ children }) => (
                  <h1 className="text-base font-bold text-text-primary mt-3 mb-1.5">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-sm font-bold text-text-primary mt-2.5 mb-1">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold text-text-primary mt-2 mb-1">
                    {children}
                  </h3>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary pl-3 my-2 text-text-secondary italic">
                    {children}
                  </blockquote>
                ),
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <div className="my-2 rounded-input overflow-hidden border border-border bg-background text-xs font-mono">
                      <div className="px-3 py-1 bg-surface border-b border-border text-text-secondary text-[11px] font-semibold uppercase">
                        {match[1]}
                      </div>
                      <pre className="p-3 overflow-x-auto text-text-primary leading-relaxed">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    </div>
                  ) : !inline ? (
                    <div className="my-2 rounded-input overflow-hidden border border-border bg-background text-xs font-mono">
                      <pre className="p-3 overflow-x-auto text-text-primary leading-relaxed">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    </div>
                  ) : (
                    <code
                      className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-xs text-primary"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}

