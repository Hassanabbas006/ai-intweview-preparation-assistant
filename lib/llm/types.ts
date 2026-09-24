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
