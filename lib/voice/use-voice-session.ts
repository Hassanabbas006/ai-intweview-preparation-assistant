"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SpeechToTextEngine } from "./stt";
import { TextToSpeechEngine } from "./tts";
import { VoiceError, VoiceState } from "./types";

interface UseVoiceSessionOptions {
  enabled: boolean;
  onFinalTranscript?: (transcript: string) => void;
}

export function useVoiceSession({ enabled, onFinalTranscript }: UseVoiceSessionOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>("IDLE");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<VoiceError | null>(null);

  const sttRef = useRef<SpeechToTextEngine | null>(null);
  const ttsRef = useRef<TextToSpeechEngine | null>(null);

  // Initialize engines lazily on client
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stt = new SpeechToTextEngine();
    const tts = new TextToSpeechEngine();

    sttRef.current = stt;
    ttsRef.current = tts;

    return () => {
      stt.cleanup();
      tts.cleanup();
    };
  }, []);

  // Update callbacks when dependencies change
  useEffect(() => {
    const stt = sttRef.current;
    const tts = ttsRef.current;

    if (stt) {
      stt.setCallbacks({
        onStateChange: (state) => {
          setVoiceState(state);
        },
        onTranscriptChange: (text) => {
          setInterimTranscript(text);
        },
        onFinalTranscript: (finalText) => {
          setInterimTranscript("");
          setVoiceState("PROCESSING");
          if (onFinalTranscript) {
            onFinalTranscript(finalText);
          }
        },
        onError: (err) => {
          setError(err);
          setVoiceState("ERROR");
        },
      });
    }

    if (tts) {
      tts.setCallbacks({
        onStart: () => {
          setVoiceState("SPEAKING");
        },
        onEnd: () => {
          setVoiceState((prev) => (prev === "SPEAKING" ? "IDLE" : prev));
        },
        onError: (err) => {
          setError(err);
          setVoiceState("ERROR");
        },
      });
    }
  }, [onFinalTranscript]);

  const startListening = useCallback(async () => {
    if (!enabled || !sttRef.current) return false;
    setError(null);
    setInterimTranscript("");

    // Stop speaking if interviewer is currently speaking
    if (ttsRef.current) {
      ttsRef.current.stop();
    }

    return await sttRef.current.startListening();
  }, [enabled]);

  const stopListening = useCallback(() => {
    if (!sttRef.current) return "";
    return sttRef.current.stopListening();
  }, []);

  const speak = useCallback(
    (text: string, messageId?: string) => {
      if (!enabled || !ttsRef.current) return false;
      return ttsRef.current.speak(text, messageId);
    },
    [enabled]
  );

  const stopSpeaking = useCallback(() => {
    if (ttsRef.current) {
      ttsRef.current.stop();
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setVoiceState("IDLE");
  }, []);

  return {
    voiceState,
    setVoiceState,
    interimTranscript,
    error,
    clearError,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    isSTTSupported: sttRef.current ? sttRef.current.isSupported() : false,
    isTTSSupported: ttsRef.current ? ttsRef.current.isSupported() : false,
  };
}
