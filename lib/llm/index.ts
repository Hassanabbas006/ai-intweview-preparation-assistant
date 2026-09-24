import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { MockLLMProvider } from "./mock";
import { LLMProvider } from "./types";

export * from "./types";
export * from "./gemini";
export * from "./groq";
export * from "./mock";

const globalForLLM = globalThis as unknown as {
  cachedLLMProvider?: LLMProvider;
};

/**
 * Returns the configured LLM provider instance per Architecture.md & Rules.md.
 * Provider-agnostic:
 * 1. Honors explicit LLM_PROVIDER="groq" | "gemini" in .env
 * 2. If LLM_PROVIDER is unset / "auto", prefers Groq if GROQ_API_KEY is present for ultra-fast TTFT (~150ms).
 * 3. Falls back to Gemini if GEMINI_API_KEY is present.
 * 4. Falls back to MockLLMProvider if no API keys are provided.
 *
 * Uses globalThis caching so that HTTP Keep-Alive sockets and TLS connection pools
 * are reused across all API routes, completely eliminating TLS cold-start overhead.
 */
export function getLLMProvider(): LLMProvider {
  if (globalForLLM.cachedLLMProvider) {
    return globalForLLM.cachedLLMProvider;
  }

  const preferredProvider = (process.env.LLM_PROVIDER || "auto").toLowerCase();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  let provider: LLMProvider;

  if (preferredProvider === "groq" && groqKey) {
    console.log("[LLM Provider] Explicitly selected Groq as primary LLM engine.");
    provider = new GroqProvider(groqKey);
  } else if (preferredProvider === "gemini" && geminiKey) {
    console.log("[LLM Provider] Explicitly selected Gemini as primary LLM engine.");
    provider = new GeminiProvider(geminiKey);
  } else if (groqKey) {
    console.log(
      "[LLM Provider] Auto-detected GROQ_API_KEY. Initializing GroqProvider for high-speed streaming."
    );
    provider = new GroqProvider(groqKey);
  } else if (geminiKey) {
    console.log(
      "[LLM Provider] Auto-detected GEMINI_API_KEY. Initializing GeminiProvider."
    );
    provider = new GeminiProvider(geminiKey);
  } else {
    console.warn(
      "[LLM Provider] Neither GROQ_API_KEY nor GEMINI_API_KEY is set. Initializing MockLLMProvider for local development."
    );
    provider = new MockLLMProvider();
  }

  globalForLLM.cachedLLMProvider = provider;
  return provider;
}


