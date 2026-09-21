import * as React from "react";
import { Sparkles } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 max-w-[85%] animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-1">
        <Sparkles className="w-4 h-4 animate-spin-slow" />
      </div>
      <div className="p-4 rounded-2xl rounded-tl-sm bg-primary/10 border border-primary/20 text-text-primary shadow-soft">
        <div className="flex items-center gap-1.5 h-5">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
          <span className="text-xs text-text-secondary ml-2 font-medium">Interviewer is thinking...</span>
        </div>
      </div>
    </div>
  );
}
