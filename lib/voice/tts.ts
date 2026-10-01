import { TTSCallbacks, VoiceError, VoiceState } from "./types";

/**
 * Strips markdown symbols, asterisks, backticks, bullet points, and code formatting
 * so that the synthesized speech sounds like natural conversational English.
 */
export function cleanTextForSpeech(rawText: string): string {
  if (!rawText) return "";

  let text = rawText;

  // Remove structural system tags or termination markers
  text = text.replace(/\[SESSION_COMPLETED\]/g, "");

  // Strip code blocks (replace with brief spoken note or skip)
  text = text.replace(/```[\s\S]*?```/g, "as shown in the code snippet.");

  // Strip inline code backticks
  text = text.replace(/`([^`]+)`/g, "$1");

  // Strip markdown bold / italic formatting
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");

  // Strip markdown headers (# Header)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Strip blockquotes (> Quote)
  text = text.replace(/^>\s+/gm, "");

  // Strip list bullets and numbers
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");

  // Strip markdown links [label](url) -> label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Normalize excessive whitespace and line breaks
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

export class TextToSpeechEngine {
  private isSpeaking = false;
  private spokenMessageIds = new Set<string>();
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private callbacks: TTSCallbacks;
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor(callbacks: TTSCallbacks = {}) {
    this.callbacks = callbacks;
    this.initVoice();
  }

  public setCallbacks(callbacks: TTSCallbacks) {
    this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private initVoice() {
    if (!this.isSupported()) return;

    const pickBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      // Prefer natural sounding English voices
      const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
      const naturalVoice = englishVoices.find(
        (v) =>
          v.name.includes("Natural") ||
          v.name.includes("Google US English") ||
          v.name.includes("Samantha") ||
          v.name.includes("Daniel") ||
          v.name.includes("Microsoft")
      );

      this.selectedVoice = naturalVoice || englishVoices[0] || voices[0] || null;
    };

    pickBestVoice();
    if (typeof window !== "undefined" && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = pickBestVoice;
    }
  }

  /**
   * Speaks the given text aloud.
   * If messageId is provided, prevents duplicate playback of the same turn.
   */
  public speak(rawText: string, messageId?: string): boolean {
    if (!this.isSupported()) {
      this.callbacks.onError?.({
        type: "NOT_SUPPORTED",
        message: "Text-to-speech is not supported in this browser.",
      });
      return false;
    }

    if (messageId && this.spokenMessageIds.has(messageId)) {
      console.log(`[TTS] Message ${messageId} already spoken, skipping duplicate.`);
      return false;
    }

    const cleanText = cleanTextForSpeech(rawText);
    if (!cleanText) return false;

    // Stop any existing speech before starting a new turn
    this.stop();

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      this.currentUtterance = utterance;

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.lang = "en-US";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        this.isSpeaking = true;
        if (messageId) {
          this.spokenMessageIds.add(messageId);
        }
        this.callbacks.onStart?.();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.callbacks.onEnd?.();
      };

      utterance.onerror = (event: any) => {
        // "canceled" or "interrupted" is a normal stop/barge-in event, not an error
        if (event.error === "canceled" || event.error === "interrupted") {
          this.isSpeaking = false;
          this.currentUtterance = null;
          this.callbacks.onEnd?.();
          return;
        }

        console.warn("[TTS Warning] Speech synthesis error:", event.error);
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.callbacks.onError?.({
          type: "SYNTHESIS_ERROR",
          message: `Voice playback error: ${event.error}`,
          originalError: event,
        });
        this.callbacks.onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err: any) {
      console.error("[TTS Error] Failed to start speech synthesis:", err);
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.callbacks.onError?.({
        type: "SYNTHESIS_ERROR",
        message: err.message || "Failed to play voice output.",
        originalError: err,
      });
      return false;
    }
  }

  /**
   * Immediately stops any active voice playback.
   */
  public stop() {
    if (!this.isSupported()) return;

    try {
      if (this.currentUtterance) {
        this.currentUtterance.onstart = null;
        this.currentUtterance.onend = null;
        this.currentUtterance.onerror = null;
      }
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }

    this.isSpeaking = false;
    this.currentUtterance = null;
    this.callbacks.onEnd?.();
  }

  public cleanup() {
    this.stop();
    this.spokenMessageIds.clear();
  }
}
