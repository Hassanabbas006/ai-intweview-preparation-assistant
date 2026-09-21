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
}

export interface LLMProvider {
  name: string;
  generateText(options: LLMGenerateOptions): Promise<string>;
  streamText(options: LLMStreamOptions): Promise<string>;
}
