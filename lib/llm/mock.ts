import { LLMGenerateOptions, LLMProvider, LLMStreamOptions } from "./types";

export class MockLLMProvider implements LLMProvider {
  name = "mock";

  async generateText(options: LLMGenerateOptions): Promise<string> {
    const lastUserMessage = [...options.messages]
      .reverse()
      .find((m) => m.role === "user")?.content || "";

    return `Got it. Looking at your approach with "${lastUserMessage.slice(0, 40)}...", how would you handle failure recovery and latency when this scales under high concurrency?`;
  }

  async streamText(options: LLMStreamOptions): Promise<string> {
    const fullText = await this.generateText(options);
    const words = fullText.split(" ");

    for (const word of words) {
      options.onChunk(word + " ");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return fullText;
  }
}
