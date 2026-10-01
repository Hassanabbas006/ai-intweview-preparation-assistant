import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isVoiceActive?: boolean;
  isListening?: boolean;
  onToggleListening?: () => void;
  voiceState?: string;
}

export function ChatInput({
  onSendMessage,
  disabled,
  placeholder = "Type your response or ask a clarifying question...",
  isVoiceActive,
  isListening,
  onToggleListening,
  voiceState,
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

  // Auto-focus textarea when re-enabled after interviewer finishes streaming
  const prevDisabledRef = useRef(disabled);
  useEffect(() => {
    if (prevDisabledRef.current && !disabled) {
      textareaRef.current?.focus();
    }
    prevDisabledRef.current = disabled;
  }, [disabled]);

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

  const effectivePlaceholder = isListening
    ? "Listening... speak now or type below"
    : isVoiceActive
    ? "Type your response or click the microphone to speak..."
    : placeholder;

  return (
    <div
      className={cn(
        "relative w-full border border-border bg-surface rounded-2xl shadow-soft p-2 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all",
        isListening && "ring-2 ring-primary/50 border-primary"
      )}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={effectivePlaceholder}
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

        <div className="ml-auto flex items-center gap-2">
          {/* Voice Microphone Toggle Button */}
          {onToggleListening && (
            <Button
              type="button"
              onClick={onToggleListening}
              disabled={disabled && !isListening}
              size="sm"
              variant={isListening ? "primary" : "outline"}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 h-9 sm:h-8 text-xs font-semibold rounded-input transition-all",
                isListening
                  ? "bg-primary text-white animate-pulse hover:bg-primary/90"
                  : "border-border text-text-secondary hover:text-text-primary hover:border-primary/40"
              )}
              title={isListening ? "Stop and submit speech" : "Speak using microphone"}
            >
              {isListening ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden xs:inline">Done Speaking</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Speak</span>
                </>
              )}
            </Button>
          )}

          {/* Text Send Button */}
          <Button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!text.trim() || disabled}
            size="sm"
            className="flex items-center justify-center gap-1.5 px-4 h-9 sm:h-8 text-xs font-semibold rounded-input min-w-[44px]"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
