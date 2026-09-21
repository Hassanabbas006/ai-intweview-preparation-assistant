import { GoogleGenAI } from "@google/genai";
import { LLMGenerateOptions, LLMMessage, LLMProvider, LLMStreamOptions } from "./types";

const GEMINI_MODELS = [
  "gemini-3.5-flash-lite", // ~800ms - 1.3s response time (Ultra-fast real-time conversational streaming)
  "gemini-3-flash-preview", // ~3.5s fallback
  "gemini-3.5-flash", // ~9s fallback
  "gemini-flash-latest",
];

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private formatContents(messages: LLMMessage[]): {
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    extractedSystem: string;
  } {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    let extractedSystem = "";

    for (const msg of messages) {
      if (msg.role === "system") {
        extractedSystem += (extractedSystem ? "\n\n" : "") + msg.content;
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Ensure at least one user turn exists if contents is empty
    if (contents.length === 0) {
      contents.push({
        role: "user",
        parts: [{ text: "Start the interview." }],
      });
    }

    return { contents, extractedSystem };
  }

  async generateText(options: LLMGenerateOptions): Promise<string> {
    const { contents, extractedSystem } = this.formatContents(options.messages);
    const systemInstruction = options.systemInstruction
      ? `${options.systemInstruction}\n\n${extractedSystem}`.trim()
      : extractedSystem || undefined;

    let lastError: any = null;

    for (const model of GEMINI_MODELS) {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens,
          },
        });

        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[GeminiProvider] Model ${model} failed, attempting next fallback:`, err?.message || err);
      }
    }

    throw new Error(
      `Gemini generation failed across all fallback models: ${lastError?.message || "Unknown error"}`
    );
  }

  async streamText(options: LLMStreamOptions): Promise<string> {
    const { contents, extractedSystem } = this.formatContents(options.messages);
    const systemInstruction = options.systemInstruction
      ? `${options.systemInstruction}\n\n${extractedSystem}`.trim()
      : extractedSystem || undefined;

    let lastError: any = null;

    for (const model of GEMINI_MODELS) {
      try {
        const stream = await this.ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens,
          },
        });

        let fullText = "";
        for await (const chunk of stream) {
          if (chunk.text) {
            fullText += chunk.text;
            options.onChunk(chunk.text);
          }
        }

        if (fullText.length > 0) {
          return fullText;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[GeminiProvider Stream] Model ${model} failed, attempting next fallback:`, err?.message || err);
      }
    }

    throw new Error(
      `Gemini streaming failed across all fallback models: ${lastError?.message || "Unknown error"}`
    );
  }
}
