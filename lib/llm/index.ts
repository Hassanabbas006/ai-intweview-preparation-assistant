import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { MockLLMProvider } from "./mock";
import {
  LLMGenerateOptions,
  LLMProvider,
  LLMStreamOptions,
  extractLLMErrorMessage,
} from "./types";

export * from "./types";
export * from "./gemini";
export * from "./groq";
export * from "./mock";

export class FallbackLLMProvider implements LLMProvider {
  name: string;
  private primary: LLMProvider;
  private fallback?: LLMProvider;

  constructor(primary: LLMProvider, fallback?: LLMProvider) {
    this.primary = primary;
    this.fallback = fallback;
    this.name = fallback ? `${primary.name}->${fallback.name}` : primary.name;
  }

  async generateText(options: LLMGenerateOptions): Promise<string> {
    try {
      return await this.primary.generateText(options);
    } catch (primaryErr: any) {
      const primaryMsg = extractLLMErrorMessage(primaryErr);
      if (this.fallback) {
        console.warn(
          `[LLM Provider Fallback] Primary provider (${this.primary.name}) failed: ${primaryMsg}. Cascading to fallback (${this.fallback.name})...`
        );
        try {
          return await this.fallback.generateText(options);
        } catch (fallbackErr: any) {
          const fallbackMsg = extractLLMErrorMessage(fallbackErr);
          throw new Error(
            `Primary (${this.primary.name}): ${primaryMsg} | Fallback (${this.fallback.name}): ${fallbackMsg}`
          );
        }
      }
      throw new Error(`Provider (${this.primary.name}) failed: ${primaryMsg}`);
    }
  }

  async streamText(options: LLMStreamOptions): Promise<string> {
    try {
      return await this.primary.streamText(options);
    } catch (primaryErr: any) {
      const primaryMsg = extractLLMErrorMessage(primaryErr);
      if (this.fallback) {
        console.warn(
          `[LLM Provider Fallback] Primary provider (${this.primary.name}) stream failed: ${primaryMsg}. Cascading to fallback (${this.fallback.name})...`
        );
        try {
          return await this.fallback.streamText(options);
        } catch (fallbackErr: any) {
          const fallbackMsg = extractLLMErrorMessage(fallbackErr);
          throw new Error(
            `Primary (${this.primary.name}): ${primaryMsg} | Fallback (${this.fallback.name}): ${fallbackMsg}`
          );
        }
      }
      throw new Error(`Provider (${this.primary.name}) failed: ${primaryMsg}`);
    }
  }
}

const globalForLLM = globalThis as unknown as {
  cachedLLMProvider?: LLMProvider;
};

/**
 * Returns the configured LLM provider instance per Architecture.md & Rules.md.
 * Provider-agnostic:
 * 1. Honors explicit LLM_PROVIDER="groq" | "gemini" in .env
 * 2. If LLM_PROVIDER is unset / "auto", prefers Groq if GROQ_API_KEY is present for ultra-fast TTFT (~150ms)
 *    and automatically cascades to Gemini if Groq experiences any failure or rate limit.
 * 3. Falls back to Gemini if only GEMINI_API_KEY is present.
 * 4. Falls back to MockLLMProvider if no API keys are provided.
 */
export function getLLMProvider(): LLMProvider {
  if (globalForLLM.cachedLLMProvider) {
    return globalForLLM.cachedLLMProvider;
  }

  const preferredProvider = (process.env.LLM_PROVIDER || "auto").toLowerCase();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  let provider: LLMProvider;

  const groq = groqKey ? new GroqProvider(groqKey) : null;
  const gemini = geminiKey ? new GeminiProvider(geminiKey) : null;

  if (preferredProvider === "groq" && groq) {
    console.log("[LLM Provider] Explicitly selected Groq as primary LLM engine (with Gemini fallback if available).");
    provider = new FallbackLLMProvider(groq, gemini || undefined);
  } else if (preferredProvider === "gemini" && gemini) {
    console.log("[LLM Provider] Explicitly selected Gemini as primary LLM engine (with Groq fallback if available).");
    provider = new FallbackLLMProvider(gemini, groq || undefined);
  } else if (groq && gemini) {
    console.log("[LLM Provider] Initialized high-resilience LLM engine: Groq (Primary) -> Gemini (Fallback).");
    provider = new FallbackLLMProvider(groq, gemini);
  } else if (groq) {
    console.log("[LLM Provider] Initialized GroqProvider as standalone engine.");
    provider = groq;
  } else if (gemini) {
    console.log("[LLM Provider] Initialized GeminiProvider as standalone engine.");
    provider = gemini;
  } else {
    console.warn("[LLM Provider] No API keys detected. Initializing MockLLMProvider for local development.");
    provider = new MockLLMProvider();
  }

  globalForLLM.cachedLLMProvider = provider;
  return provider;
}
