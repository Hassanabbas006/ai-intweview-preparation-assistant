import { GeminiProvider } from "./gemini";
import { MockLLMProvider } from "./mock";
import { LLMProvider } from "./types";

export * from "./types";
export * from "./gemini";
export * from "./mock";

let cachedProvider: LLMProvider | null = null;

/**
 * Returns the configured LLM provider instance per Architecture.md & Rules.md.
 * Provider-agnostic: uses Google Gemini API by default, or Mock provider if no API key is set.
 */
export function getLLMProvider(): LLMProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey && geminiKey.trim() !== "") {
    cachedProvider = new GeminiProvider(geminiKey);
    return cachedProvider;
  }

  console.warn(
    "[LLM Provider] GEMINI_API_KEY is not set. Initializing MockLLMProvider for local development."
  );
  cachedProvider = new MockLLMProvider();
  return cachedProvider;
}
