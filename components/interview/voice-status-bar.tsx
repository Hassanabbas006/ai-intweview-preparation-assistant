"use client";

import * as React from "react";
import { Mic, MicOff, Volume2, VolumeX, AlertCircle, RefreshCw, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoiceState, VoiceError } from "@/lib/voice/types";

interface VoiceStatusBarProps {
  modality: "TEXT" | "VOICE";
  onToggleModality?: () => void;
  voiceState: VoiceState;
  interimTranscript?: string;
  error?: VoiceError | null;
  onClearError?: () => void;
  onStartListening?: () => void;
  onStopListening?: () => void;
  onStopSpeaking?: () => void;
  disabled?: boolean;
}

export function VoiceStatusBar({
  modality,
  onToggleModality,
  voiceState,
  interimTranscript,
  error,
  onClearError,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  disabled,
}: VoiceStatusBarProps) {
  const isVoice = modality === "VOICE";

  return (
    <div className="w-full flex flex-col gap-2 p-3 rounded-2xl bg-surface border border-border shadow-soft transition-all">
      {/* Top row: Status indicators & Modality Switcher */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {isVoice ? (
            <Badge variant="primary" className="flex items-center gap-1.5 px-2.5 py-1 text-xs">
              <Radio className="w-3.5 h-3.5 animate-pulse text-white" />
              <span>Voice Mode (Active)</span>
            </Badge>
          ) : (
            <Badge variant="neutral" className="flex items-center gap-1.5 px-2.5 py-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-text-secondary/50" />
              <span>Text Mode</span>
            </Badge>
          )}

          {/* Voice State Badge */}
          {isVoice && (
            <>
              {voiceState === "LISTENING" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Listening...
                </span>
              )}
              {voiceState === "PROCESSING" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-blue animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Processing answer...
                </span>
              )}
              {voiceState === "SPEAKING" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success animate-pulse">
                  <Volume2 className="w-3.5 h-3.5" />
                  Interviewer speaking...
                </span>
              )}
              {voiceState === "IDLE" && (
                <span className="text-xs text-text-secondary">Ready to speak</span>
              )}
              {voiceState === "ERROR" && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-error">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Voice issue
                </span>
              )}
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isVoice && voiceState === "SPEAKING" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStopSpeaking}
              className="h-8 text-xs flex items-center gap-1 border-primary/40 text-primary hover:bg-primary/10"
            >
              <VolumeX className="w-3.5 h-3.5" /> Stop Speaking
            </Button>
          )}

          {onToggleModality && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleModality}
              className="h-8 text-xs text-text-secondary hover:text-text-primary"
            >
              Switch to {isVoice ? "Text" : "Voice"}
            </Button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {isVoice && error && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-error/15 border border-error/30 text-xs text-error">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error.message}</span>
          </div>
          {onClearError && (
            <button
              type="button"
              onClick={onClearError}
              className="text-[11px] underline font-medium hover:opacity-80"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Interim Speech Preview */}
      {isVoice && (voiceState === "LISTENING" || interimTranscript) && (
        <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-text-primary animate-fade-in flex items-start gap-2">
          <Mic className="w-4 h-4 text-primary shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Live Transcript
            </span>
            <p className="italic text-text-primary leading-relaxed">
              {interimTranscript || "Listening... speak now"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
