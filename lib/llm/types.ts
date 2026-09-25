export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMGenerateOptions {
  messages: LLMMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LLMStreamOptions extends LLMGenerateOptions {
  onChunk: (chunk: string) => void;
  onMeta?: (meta: { provider: string; model: string }) => void;
}

export interface LLMResponseResult {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface LLMProvider {
  name: string;
  generateText(options: LLMGenerateOptions): Promise<string>;
  streamText(options: LLMStreamOptions): Promise<string>;
}

export function extractLLMErrorMessage(err: any): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.error?.message) return String(err.error.message);
  if (err.message) return String(err.message);
  if (err.statusText) return `HTTP ${err.status}: ${err.statusText}`;
  if (err.status) return `HTTP Error ${err.status}`;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
