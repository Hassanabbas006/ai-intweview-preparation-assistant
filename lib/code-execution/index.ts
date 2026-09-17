/**
 * Provider-agnostic Code Execution interface stub per Architecture.md & Rules.md.
 * Allows switching between Piston, Judge0 (RapidAPI), or self-hosted Judge0 CE.
 */

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtimeMs?: number;
  memoryKb?: number;
}

export interface CodeExecutionProvider {
  execute(language: string, code: string, stdin?: string): Promise<ExecutionResult>;
}

export function getCodeExecutionProvider(): CodeExecutionProvider {
  // In Phase 7, this will instantiate Piston or Judge0 based on environment variables
  return {
    async execute() {
      throw new Error("Code execution provider will be implemented in Phase 7");
    },
  };
}
