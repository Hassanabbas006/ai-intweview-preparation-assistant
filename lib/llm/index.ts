/**
 * Provider-agnostic LLM interface definition per Architecture.md & Rules.md.
 * Allows switching between Gemini API, Groq, or Claude without rewriting business logic.
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMStreamCallbacks {
  onToken?: (token: string) => void;
  onError?: (error: Error) => void;
  onComplete?: (fullText: string) => void;
}

export interface LLMProvider {
  generateResponse(messages: LLMMessage[]): Promise<string>;
  streamResponse(
    messages: LLMMessage[],
    callbacks: LLMStreamCallbacks
  ): Promise<ReadableStream<string>>;
}

/**
 * Factory stub to get configured LLM provider instance
 */
export function getLLMProvider(): LLMProvider {
  // In Phase 2, this will instantiate Gemini or Groq based on environment variables
  return {
    async generateResponse() {
      throw new Error("LLM provider will be implemented in Phase 2");
    },
    async streamResponse() {
      throw new Error("LLM streaming will be implemented in Phase 2");
    },
  };
}
