import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { Send, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  disabled,
  placeholder = "Type your response or ask a clarifying question...",
}: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || disabled) return;

    onSendMessage(text.trim());
    setText("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative w-full border border-border bg-surface rounded-2xl shadow-soft p-2 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full resize-none bg-transparent px-3 py-2 text-base sm:text-sm text-text-primary placeholder:text-text-secondary/70 focus:outline-none disabled:opacity-50 min-h-[48px] max-h-[200px]"
      />

      <div className="flex items-center justify-between pt-1.5 px-2 border-t border-border/40">
        <span className="text-[11px] text-text-secondary hidden sm:inline-flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">
            Enter
          </kbd>{" "}
          to send,{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">
            Shift+Enter
          </kbd>{" "}
          for newline
        </span>

        <Button
          type="button"
          onClick={() => handleSubmit()}
          disabled={!text.trim() || disabled}
          size="sm"
          className="ml-auto flex items-center justify-center gap-1.5 px-4 h-9 sm:h-8 text-xs font-semibold rounded-input min-w-[44px]"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
