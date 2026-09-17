/**
 * ATS Scoring & Suggestion Logic Stub per Architecture.md.
 * Implementation will occur in Phase 4: Resume upload, ATS scoring & suggestions.
 */

export interface AtsScanResult {
  score: number;
  mode: "JOB_TARGETED" | "GENERAL";
  keywordGaps: string[];
  formattingFixes: string[];
  phrasingSuggestions: string[];
}
