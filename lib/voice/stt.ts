import { STTCallbacks, VoiceError, VoiceState } from "./types";

// Declarations for browser SpeechRecognition API
interface IWindowSpeechRecognition extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export class SpeechToTextEngine {
  private recognition: any = null;
  private mediaStream: MediaStream | null = null;
  private isListening = false;
  private accumulatedFinalTranscript = "";
  private callbacks: STTCallbacks;

  constructor(callbacks: STTCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: STTCallbacks) {
    this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const win = window as IWindowSpeechRecognition;
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  /**
   * Explicitly requests and verifies microphone hardware permissions.
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.callbacks.onError?.({
        type: "NOT_SUPPORTED",
        message: "Microphone access is not supported by your current browser environment.",
      });
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Keep reference to stop tracks later
      this.mediaStream = stream;
      return true;
    } catch (err: any) {
      const errorName = err?.name || "";
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        this.callbacks.onError?.({
          type: "PERMISSION_DENIED",
          message: "Microphone permission was denied. Please allow microphone access in your browser settings.",
          originalError: err,
        });
      } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        this.callbacks.onError?.({
          type: "NO_MIC",
          message: "No microphone device detected. Please connect an audio input device.",
          originalError: err,
        });
      } else {
        this.callbacks.onError?.({
          type: "AUDIO_CAPTURE_ERROR",
          message: `Microphone error: ${err.message || "Failed to access microphone."}`,
          originalError: err,
        });
      }
      return false;
    }
  }

  /**
   * Starts listening for candidate speech.
   */
  public async startListening(): Promise<boolean> {
    if (this.isListening) return true;

    if (!this.isSupported()) {
      this.callbacks.onError?.({
        type: "NOT_SUPPORTED",
        message: "Speech recognition is not supported in this browser. Please use Chrome, Edge, or switch to Text mode.",
      });
      return false;
    }

    // Verify microphone hardware permission first
    const hasPermission = await this.requestMicrophonePermission();
    if (!hasPermission) {
      this.callbacks.onStateChange?.("ERROR");
      return false;
    }

    try {
      const win = window as IWindowSpeechRecognition;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass();

      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
      this.recognition.maxAlternatives = 1;

      this.accumulatedFinalTranscript = "";

      this.recognition.onstart = () => {
        this.isListening = true;
        this.callbacks.onStateChange?.("LISTENING");
      };

      this.recognition.onresult = (event: any) => {
        let interim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalChunk += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (finalChunk) {
          this.accumulatedFinalTranscript += (this.accumulatedFinalTranscript ? " " : "") + finalChunk.trim();
        }

        const currentDisplay = [this.accumulatedFinalTranscript, interim].filter(Boolean).join(" ").trim();
        this.callbacks.onTranscriptChange?.(currentDisplay);
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error;
        console.warn("[STT Warning] Speech recognition event error:", error);

        if (error === "not-allowed") {
          this.callbacks.onError?.({
            type: "PERMISSION_DENIED",
            message: "Microphone permission was blocked. Please grant access in your browser.",
          });
          this.callbacks.onStateChange?.("ERROR");
        } else if (error === "no-speech") {
          // Normal silence, don't crash
        } else if (error === "audio-capture") {
          this.callbacks.onError?.({
            type: "AUDIO_CAPTURE_ERROR",
            message: "Could not capture audio from your microphone.",
          });
          this.callbacks.onStateChange?.("ERROR");
        } else if (error === "network") {
          this.callbacks.onError?.({
            type: "NETWORK_ERROR",
            message: "Network error during speech recognition.",
          });
        }
      };

      this.recognition.onend = () => {
        const wasListening = this.isListening;
        this.isListening = false;
        this.cleanupMediaStream();

        if (wasListening) {
          const finalResult = this.accumulatedFinalTranscript.trim();
          if (finalResult) {
            this.callbacks.onStateChange?.("PROCESSING");
            this.callbacks.onFinalTranscript?.(finalResult);
          } else {
            this.callbacks.onStateChange?.("IDLE");
          }
        }
      };

      this.recognition.start();
      return true;
    } catch (err: any) {
      console.error("[STT Error] Failed to start speech recognition:", err);
      this.cleanup();
      this.callbacks.onError?.({
        type: "AUDIO_CAPTURE_ERROR",
        message: err.message || "Failed to initialize speech recognition.",
        originalError: err,
      });
      this.callbacks.onStateChange?.("ERROR");
      return false;
    }
  }

  /**
   * Stops listening and finalizes candidate transcript.
   */
  public stopListening(): string {
    if (!this.isListening && !this.recognition) {
      return this.accumulatedFinalTranscript.trim();
    }

    this.isListening = false;
    const finalResult = this.accumulatedFinalTranscript.trim();

    try {
      if (this.recognition) {
        this.recognition.stop();
      }
    } catch {
      // Ignore if already stopped
    }

    this.cleanupMediaStream();

    if (finalResult) {
      this.callbacks.onStateChange?.("PROCESSING");
      this.callbacks.onFinalTranscript?.(finalResult);
    } else {
      this.callbacks.onStateChange?.("IDLE");
    }

    return finalResult;
  }

  /**
   * Aborts listening without producing a final transcript.
   */
  public abort() {
    this.isListening = false;
    this.accumulatedFinalTranscript = "";
    try {
      if (this.recognition) {
        this.recognition.abort();
      }
    } catch {
      // Ignore
    }
    this.cleanup();
    this.callbacks.onStateChange?.("IDLE");
  }

  private cleanupMediaStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      this.mediaStream = null;
    }
  }

  public cleanup() {
    this.cleanupMediaStream();
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
  }
}
