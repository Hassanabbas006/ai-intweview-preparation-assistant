import { LLMGenerateOptions, LLMProvider, LLMStreamOptions } from "./types";

export class MockLLMProvider implements LLMProvider {
  name = "mock";

  async generateText(options: LLMGenerateOptions): Promise<string> {
    const lastUserMessage = [...options.messages]
      .reverse()
      .find((m) => m.role === "user")?.content || "";

    return `Thank you for sharing that. You mentioned: "${lastUserMessage.slice(0, 50)}...". Let's dive deeper into how you measure the performance and scalability of your solution in a production environment.`;
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
