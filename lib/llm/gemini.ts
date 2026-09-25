import { GoogleGenAI } from "@google/genai";
import {
  LLMGenerateOptions,
  LLMMessage,
  LLMProvider,
  LLMStreamOptions,
  extractLLMErrorMessage,
} from "./types";

const GEMINI_MODELS = [
  "gemini-3.5-flash-lite", // ~800ms - 1.3s response time
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-flash-latest",
];

const MODEL_TIMEOUT_MS = 10000; // 10s timeout per model attempt

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

    // Retain last 20 messages to prevent context window bloat in long interviews
    const recentMessages = messages.length > 20 ? messages.slice(-20) : messages;

    for (const msg of recentMessages) {
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
    const errorsList: string[] = [];
    const startTime = Date.now();

    for (const model of GEMINI_MODELS) {
      let timeoutHandle: NodeJS.Timeout | null = null;
      try {
        console.log(`[LLM:Gemini] Requesting completion from ${model} (timeout: ${MODEL_TIMEOUT_MS}ms)...`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Gemini model ${model} timed out after ${MODEL_TIMEOUT_MS}ms`)),
            MODEL_TIMEOUT_MS
          );
        });

        const completionPromise = this.ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: options.temperature ?? 0.5,
            maxOutputTokens: options.maxOutputTokens ?? 200,
          },
        });

        const response = await Promise.race([completionPromise, timeoutPromise]);
        if (timeoutHandle) clearTimeout(timeoutHandle);

        const text = response.text || "";
        const duration = Date.now() - startTime;
        console.log(
          `[LLM:Gemini Success] Served by ${model} in ${duration}ms (${text.length} chars)`
        );

        if (text) {
          return text;
        }
      } catch (err: any) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        lastError = err;
        const msg = extractLLMErrorMessage(err);
        errorsList.push(`${model}: ${msg}`);
        console.warn(
          `[LLM:Gemini Fallback] Model ${model} failed: ${msg}. Trying next fallback model.`
        );
      }
    }

    const detailedError = errorsList.length > 0 ? errorsList.join(" | ") : extractLLMErrorMessage(lastError);
    throw new Error(`Gemini generation failed across all fallback models: ${detailedError}`);
  }

  async streamText(options: LLMStreamOptions): Promise<string> {
    const { contents, extractedSystem } = this.formatContents(options.messages);
    const systemInstruction = options.systemInstruction
      ? `${options.systemInstruction}\n\n${extractedSystem}`.trim()
      : extractedSystem || undefined;

    let lastError: any = null;
    const errorsList: string[] = [];
    const startTime = Date.now();

    for (const model of GEMINI_MODELS) {
      let timeoutHandle: NodeJS.Timeout | null = null;
      try {
        console.log(`[LLM:Gemini Stream] Starting stream from ${model} (TTFT timeout: ${MODEL_TIMEOUT_MS}ms)...`);

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Gemini stream TTFT for ${model} timed out after ${MODEL_TIMEOUT_MS}ms`)),
            MODEL_TIMEOUT_MS
          );
        });

        const streamPromise = this.ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: options.temperature ?? 0.5,
            maxOutputTokens: options.maxOutputTokens ?? 200,
          },
        });

        const stream = await Promise.race([streamPromise, timeoutPromise]);
        const iterator = stream[Symbol.asyncIterator]();

        // Wait for first chunk to arrive within timeout window
        const firstChunkResult = await Promise.race([iterator.next(), timeoutPromise]);
        if (timeoutHandle) clearTimeout(timeoutHandle);

        options.onMeta?.({ provider: "gemini", model });

        let fullText = "";
        const firstTokenTime = Date.now() - startTime;
        console.log(
          `[LLM:Gemini TTFT] First token from ${model} arrived in ${firstTokenTime}ms`
        );

        if (!firstChunkResult.done && firstChunkResult.value) {
          if (firstChunkResult.value.text) {
            fullText += firstChunkResult.value.text;
            options.onChunk(firstChunkResult.value.text);
          }
        }

        // Stream subsequent tokens to completion
        while (true) {
          const { value, done } = await iterator.next();
          if (done) break;

          if (value.text) {
            fullText += value.text;
            options.onChunk(value.text);
          }
        }

        const totalTime = Date.now() - startTime;
        console.log(
          `[LLM:Gemini Stream Done] Completed from ${model} in ${totalTime}ms (Total chars: ${fullText.length})`
        );

        if (fullText.length > 0) {
          return fullText;
        }
      } catch (err: any) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        lastError = err;
        const msg = extractLLMErrorMessage(err);
        errorsList.push(`${model}: ${msg}`);
        console.warn(
          `[LLM:Gemini Stream Fallback] Model ${model} failed: ${msg}. Trying next fallback model.`
        );
      }
    }

    const detailedError = errorsList.length > 0 ? errorsList.join(" | ") : extractLLMErrorMessage(lastError);
    throw new Error(`Gemini streaming failed across all fallback models: ${detailedError}`);
  }
}
