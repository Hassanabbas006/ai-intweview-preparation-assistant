export type VoiceState = "IDLE" | "LISTENING" | "PROCESSING" | "SPEAKING" | "ERROR";

export type VoiceErrorType =
  | "PERMISSION_DENIED"
  | "NOT_SUPPORTED"
  | "NO_MIC"
  | "AUDIO_CAPTURE_ERROR"
  | "NETWORK_ERROR"
  | "SYNTHESIS_ERROR"
  | "UNKNOWN";

export interface VoiceError {
  type: VoiceErrorType;
  message: string;
  originalError?: any;
}

export interface STTCallbacks {
  onTranscriptChange?: (interimTranscript: string) => void;
  onFinalTranscript?: (finalTranscript: string) => void;
  onStateChange?: (state: VoiceState) => void;
  onError?: (error: VoiceError) => void;
}

export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: VoiceError) => void;
}
