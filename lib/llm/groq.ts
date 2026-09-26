import Groq from "groq-sdk";
import {
  LLMGenerateOptions,
  LLMMessage,
  LLMProvider,
  LLMStreamOptions,
  extractLLMErrorMessage,
} from "./types";

const GROQ_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];

const MODEL_TIMEOUT_MS = 6000; // 6s timeout per model attempt

export class GroqProvider implements LLMProvider {
  name = "groq";
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  private formatMessages(
    messages: LLMMessage[],
    systemInstruction?: string
  ): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const formatted: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [];

    if (systemInstruction) {
      formatted.push({ role: "system", content: systemInstruction });
    }

    // Retain last 20 messages to prevent context window overflow in long interviews
    const recentMessages = messages.length > 20 ? messages.slice(-20) : messages;

    for (const msg of recentMessages) {
      formatted.push({ role: msg.role, content: msg.content });
    }

    return formatted;
  }

  async generateText(options: LLMGenerateOptions): Promise<string> {
    const messages = this.formatMessages(
      options.messages,
      options.systemInstruction
    );
    let lastError: any = null;
    const errorsList: string[] = [];
    const startTime = Date.now();

    for (const model of GROQ_MODELS) {
      let timeoutHandle: NodeJS.Timeout | null = null;
      try {
        console.log(`[LLM:Groq] Requesting completion from ${model} (timeout: ${MODEL_TIMEOUT_MS}ms)...`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Groq model ${model} timed out after ${MODEL_TIMEOUT_MS}ms`)),
            MODEL_TIMEOUT_MS
          );
        });

        const completionPromise = this.client.chat.completions.create({
          model,
          messages,
          temperature: options.temperature ?? 0.5,
          max_tokens: options.maxOutputTokens ?? 200,
        });

        const completion = await Promise.race([completionPromise, timeoutPromise]);
        if (timeoutHandle) clearTimeout(timeoutHandle);

        const text = completion.choices[0]?.message?.content || "";
        const duration = Date.now() - startTime;
        console.log(
          `[LLM:Groq Success] Served by ${model} in ${duration}ms (${text.length} chars)`
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
          `[LLM:Groq Fallback] Model ${model} failed: ${msg}. Trying next fallback model.`
        );
      }
    }

    const detailedError = errorsList.length > 0 ? errorsList.join(" | ") : extractLLMErrorMessage(lastError);
    throw new Error(`Groq generation failed across all models: ${detailedError}`);
  }

  async streamText(options: LLMStreamOptions): Promise<string> {
    const messages = this.formatMessages(
      options.messages,
      options.systemInstruction
    );
    let lastError: any = null;
    const errorsList: string[] = [];
    const startTime = Date.now();

    for (const model of GROQ_MODELS) {
      let timeoutHandle: NodeJS.Timeout | null = null;
      try {
        console.log(`[LLM:Groq Stream] Starting stream from ${model} (TTFT timeout: ${MODEL_TIMEOUT_MS}ms)...`);

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Groq stream TTFT for ${model} timed out after ${MODEL_TIMEOUT_MS}ms`)),
            MODEL_TIMEOUT_MS
          );
        });

        const streamPromise = this.client.chat.completions.create({
          model,
          messages,
          temperature: options.temperature ?? 0.5,
          max_tokens: options.maxOutputTokens ?? 200,
          stream: true,
        });

        const stream = await Promise.race([streamPromise, timeoutPromise]);
        const iterator = stream[Symbol.asyncIterator]();

        // Wait for first chunk to arrive within timeout window
        const firstChunkResult = await Promise.race([iterator.next(), timeoutPromise]);
        if (timeoutHandle) clearTimeout(timeoutHandle);

        options.onMeta?.({ provider: "groq", model });

        let fullText = "";
        const firstTokenTime = Date.now() - startTime;
        console.log(
          `[LLM:Groq TTFT] First token from ${model} arrived in ${firstTokenTime}ms`
        );

        if (!firstChunkResult.done && firstChunkResult.value) {
          const firstDelta = firstChunkResult.value.choices[0]?.delta?.content || "";
          if (firstDelta) {
            fullText += firstDelta;
            options.onChunk(firstDelta);
          }
        }

        // Stream subsequent tokens to completion
        while (true) {
          const { value, done } = await iterator.next();
          if (done) break;

          const delta = value.choices[0]?.delta?.content || "";
          if (delta) {
            fullText += delta;
            options.onChunk(delta);
          }
        }

        const totalTime = Date.now() - startTime;
        console.log(
          `[LLM:Groq Stream Done] Completed from ${model} in ${totalTime}ms (Total chars: ${fullText.length})`
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
          `[LLM:Groq Stream Fallback] Model ${model} failed: ${msg}. Trying next fallback model.`
        );
      }
    }

    const detailedError = errorsList.length > 0 ? errorsList.join(" | ") : extractLLMErrorMessage(lastError);
    throw new Error(`Groq streaming failed across all models: ${detailedError}`);
  }
}
