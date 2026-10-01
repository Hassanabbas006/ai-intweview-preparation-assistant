import { prisma } from "@/lib/prisma";
import { Prisma, SynthesisStatus } from "@prisma/client";
import { z } from "zod";
import { getLLMProvider, extractLLMErrorMessage } from "@/lib/llm";
import { DeterministicReportPayload, PillarReportItem } from "./report-generator";

// ============================================================================
// PHASE 4B-1 CONTRACTS & ZOD SCHEMAS
// ============================================================================

export const SynthesisStrengthSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  evidenceTurn: z.number().int().positive().nullable(),
  evidenceQuote: z.string().nullable(),
});

export const SynthesisWeaknessSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  evidenceTurn: z.number().int().positive().nullable(),
  evidenceQuote: z.string().nullable(),
});

export const SynthesisTipSchema = z.object({
  area: z.string().min(1, "Area is required"),
  problem: z.string().min(1, "Problem is required"),
  specificAction: z.string().min(1, "Specific action is required"),
  whyItMatters: z.string().min(1, "Why it matters is required"),
});

export const LLMReportSynthesisSchema = z.object({
  executiveSummary: z.string().min(10, "Executive summary must be substantive"),
  strengths: z.array(SynthesisStrengthSchema).min(1).max(5),
  weaknesses: z.array(SynthesisWeaknessSchema).min(1).max(5),
  actionableTips: z.array(SynthesisTipSchema).min(1).max(5),
});

export type LLMReportSynthesis = z.infer<typeof LLMReportSynthesisSchema>;
export type SynthesisStrength = z.infer<typeof SynthesisStrengthSchema>;
export type SynthesisWeakness = z.infer<typeof SynthesisWeaknessSchema>;
export type SynthesisTip = z.infer<typeof SynthesisTipSchema>;

export interface SynthesisOptions {
  forceRefresh?: boolean;
  timeoutMs?: number;
}

export interface SynthesisResult {
  sessionId: string;
  synthesisStatus: SynthesisStatus;
  executiveSummary: string | null;
  strengths: SynthesisStrength[];
  weaknesses: SynthesisWeakness[];
  actionableTips: SynthesisTip[];
  synthesisModel: string | null;
  synthesisPromptVersion: string | null;
  synthesisError: string | null;
  durationMs: number;
}

// ============================================================================
// EVIDENCE NORMALIZATION & GROUNDING VALIDATOR
// ============================================================================

/**
 * Normalizes text for evidence quote substring matching.
 * Strips punctuation, collapses whitespace, converts to lowercase.
 */
export function normalizeTextForQuoteMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strictly validates evidence turns and quotes against actual candidate transcript.
 *
 * Rules:
 * 1. evidenceTurn must map to an actual candidate message.
 * 2. evidenceQuote must exist as a substring (or normalized match) in that candidate message.
 * 3. Invalid or fabricated quotes are stripped to null (NEVER replaced with fabricated quotes).
 * 4. Quotes referencing interviewer messages or nonexistent turns are strictly nullified.
 */
export function validateAndCleanEvidenceQuotes(
  items: Array<{
    title: string;
    description: string;
    evidenceTurn: number | null;
    evidenceQuote: string | null;
  }>,
  candidateTurnsMap: Map<number, string>
): Array<{
  title: string;
  description: string;
  evidenceTurn: number | null;
  evidenceQuote: string | null;
}> {
  return items.map((item) => {
    if (item.evidenceTurn === null || item.evidenceTurn === undefined) {
      return {
        ...item,
        evidenceTurn: null,
        evidenceQuote: null,
      };
    }

    const candidateMessage = candidateTurnsMap.get(item.evidenceTurn);

    // If turn does not map to an actual candidate response
    if (!candidateMessage || !candidateMessage.trim()) {
      return {
        ...item,
        evidenceTurn: null,
        evidenceQuote: null,
      };
    }

    if (!item.evidenceQuote || !item.evidenceQuote.trim()) {
      return {
        ...item,
        evidenceTurn: null,
        evidenceQuote: null,
      };
    }

    const normMessage = normalizeTextForQuoteMatch(candidateMessage);
    const normQuote = normalizeTextForQuoteMatch(item.evidenceQuote);

    // Verify quote is a genuine substring of candidate's actual message
    if (normQuote.length > 0 && normMessage.includes(normQuote)) {
      return {
        ...item,
        evidenceTurn: item.evidenceTurn,
        evidenceQuote: item.evidenceQuote.trim(),
      };
    }

    // Fabricated, altered, or ungrounded quote: strip to null
    return {
      ...item,
      evidenceTurn: null,
      evidenceQuote: null,
    };
  });
}

// ============================================================================
// REPORT SYNTHESIZER SERVICE
// ============================================================================

export class ReportSynthesizerService {
  private static readonly PROMPT_VERSION = "phase-4b1-v1";
  private static readonly DEFAULT_TIMEOUT_MS = 25000;

  /**
   * Primary entry point for Phase 4B-1: Qualitative LLM Report Synthesis.
   *
   * ARCHITECTURAL GUARANTEES:
   * 1. The deterministic report is authoritative for all scores, levels, difficulty, and pillars.
   * 2. The LLM explains qualitative evidence; it NEVER overrides or mutates deterministic values.
   * 3. Quotes are strictly validated against stored candidate transcript turns.
   * 4. A synthesis failure NEVER corrupts a READY deterministic report.
   * 5. Aptitude track produces deterministic synthesis without conversational LLM.
   */
  static async synthesizeReport(
    sessionId: string,
    options: SynthesisOptions = {},
    prismaClient: typeof prisma | Prisma.TransactionClient = prisma
  ): Promise<SynthesisResult> {
    const startTime = performance.now();
    const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;

    // 1. Fetch Session with full Messages and EvaluationJobs
    const session = await prismaClient.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        report: true,
        messages: { orderBy: { createdAt: "asc" } },
        evaluationJobs: { orderBy: { turnSequenceNumber: "asc" } },
      },
    });

    if (!session) {
      throw new Error(`Interview session not found: ${sessionId}`);
    }

    if (!session.report) {
      throw new Error(
        `Deterministic report not found for session ${sessionId}. Phase 4A report must be persisted before synthesis.`
      );
    }

    const report = session.report;

    // 2. Idempotency Check: Reuse existing READY synthesis if already completed
    if (
      report.synthesisStatus === "SYNTHESIS_READY" &&
      !options.forceRefresh &&
      report.executiveSummary
    ) {
      return {
        sessionId,
        synthesisStatus: "SYNTHESIS_READY",
        executiveSummary: report.executiveSummary,
        strengths: (report.structuredStrengths as any) || [],
        weaknesses: (report.structuredWeaknesses as any) || [],
        actionableTips: (report.structuredTips as any) || [],
        synthesisModel: report.synthesisModel,
        synthesisPromptVersion: report.synthesisPromptVersion,
        synthesisError: null,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 3. Concurrency Protection: If currently generating, do not spawn duplicate synthesis
    if (report.synthesisStatus === "SYNTHESIS_GENERATING" && !options.forceRefresh) {
      return {
        sessionId,
        synthesisStatus: "SYNTHESIS_GENERATING",
        executiveSummary: report.executiveSummary,
        strengths: (report.structuredStrengths as any) || [],
        weaknesses: (report.structuredWeaknesses as any) || [],
        actionableTips: (report.structuredTips as any) || [],
        synthesisModel: report.synthesisModel,
        synthesisPromptVersion: report.synthesisPromptVersion,
        synthesisError: null,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 4. Mark Status: SYNTHESIS_GENERATING
    await prismaClient.interviewReport.update({
      where: { id: report.id },
      data: {
        synthesisStatus: "SYNTHESIS_GENERATING",
        synthesisError: null,
        synthesisUpdatedAt: new Date(),
      },
    });

    // 5. Handle APTITUDE Track: 100% Deterministic Synthesis (Zero Conversational LLM)
    if (session.type === "APTITUDE") {
      const aptResult = this.generateAptitudeSynthesis(session, report);
      await this.persistSynthesisOutput(
        report.id,
        aptResult,
        "deterministic-aptitude-engine",
        prismaClient
      );
      return {
        sessionId,
        synthesisStatus: "SYNTHESIS_READY",
        ...aptResult,
        synthesisModel: "deterministic-aptitude-engine",
        synthesisPromptVersion: this.PROMPT_VERSION,
        synthesisError: null,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 6. Build Candidate Turns Map (candidate turns indexed 1, 2, 3...)
    const candidateTurnsMap = new Map<number, string>();
    let candidateTurnIndex = 0;
    for (const msg of session.messages) {
      if (msg.role === "user") {
        candidateTurnIndex++;
        candidateTurnsMap.set(candidateTurnIndex, msg.content);
      }
    }

    // 7. Check Empty Transcript Edge Case
    if (candidateTurnsMap.size === 0) {
      const emptyResult: LLMReportSynthesis = {
        executiveSummary:
          "The interview session was concluded without any substantive candidate responses recorded. Performance could not be evaluated qualitatively.",
        strengths: [
          {
            title: "Session Initiated",
            description: "Candidate initiated the interview session.",
            evidenceTurn: null,
            evidenceQuote: null,
          },
        ],
        weaknesses: [
          {
            title: "Insufficient Evidence",
            description: "No substantive candidate answers were submitted to assess skills.",
            evidenceTurn: null,
            evidenceQuote: null,
          },
        ],
        actionableTips: [
          {
            area: "Participation",
            problem: "No responses were recorded during the interview session.",
            specificAction: "Complete full responses to technical prompts in the next session.",
            whyItMatters: "Evaluation requires candidate responses to assess domain competencies.",
          },
        ],
      };

      await this.persistSynthesisOutput(
        report.id,
        emptyResult,
        "deterministic-fallback",
        prismaClient
      );

      return {
        sessionId,
        synthesisStatus: "SYNTHESIS_READY",
        ...emptyResult,
        synthesisModel: "deterministic-fallback",
        synthesisPromptVersion: this.PROMPT_VERSION,
        synthesisError: null,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 8. Execute LLM Synthesis with Grounded Prompt & Provider Fallback
    try {
      const prompt = this.buildSynthesisPrompt(session, report, candidateTurnsMap);
      const provider = getLLMProvider();

      let timeoutHandle: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`Synthesis request timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      });

      const completionPromise = provider.generateText({
        messages: [{ role: "user", content: prompt.userPrompt }],
        systemInstruction: prompt.systemPrompt,
        temperature: 0.2, // Low temperature for high adherence to evidence
        maxOutputTokens: 2500,
      });

      const rawResponse = await Promise.race([completionPromise, timeoutPromise]);
      if (timeoutHandle) clearTimeout(timeoutHandle);

      // 9. Extract and strictly validate JSON
      const parsedSynthesis = this.parseAndValidateSynthesisJSON(rawResponse);

      // 10. Evidence Grounding Verification
      const groundedStrengths = validateAndCleanEvidenceQuotes(
        parsedSynthesis.strengths,
        candidateTurnsMap
      );
      const groundedWeaknesses = validateAndCleanEvidenceQuotes(
        parsedSynthesis.weaknesses,
        candidateTurnsMap
      );

      const validatedOutput: LLMReportSynthesis = {
        executiveSummary: parsedSynthesis.executiveSummary,
        strengths: groundedStrengths,
        weaknesses: groundedWeaknesses,
        actionableTips: parsedSynthesis.actionableTips,
      };

      // 11. Persist validated synthesis output (DETERMINISTIC SCORES REMAIN UNTOUCHED)
      await this.persistSynthesisOutput(
        report.id,
        validatedOutput,
        provider.name,
        prismaClient
      );

      return {
        sessionId,
        synthesisStatus: "SYNTHESIS_READY",
        ...validatedOutput,
        synthesisModel: provider.name,
        synthesisPromptVersion: this.PROMPT_VERSION,
        synthesisError: null,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      const errorMsg = extractLLMErrorMessage(err);
      console.error(`[Synthesis Error - Session ${sessionId}]:`, errorMsg);

      // 12. Failure Isolation: Persist SYNTHESIS_FAILED without corrupting deterministic report
      await prismaClient.interviewReport.update({
        where: { id: report.id },
        data: {
          synthesisStatus: "SYNTHESIS_FAILED",
          synthesisError: errorMsg,
          synthesisUpdatedAt: new Date(),
        },
      });

      return {
        sessionId,
        synthesisStatus: "SYNTHESIS_FAILED",
        executiveSummary: null,
        strengths: [],
        weaknesses: [],
        actionableTips: [],
        synthesisModel: null,
        synthesisPromptVersion: this.PROMPT_VERSION,
        synthesisError: errorMsg,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * Constructs the dedicated grounded prompt for report synthesis.
   * Clearly separates deterministic authoritative evidence from candidate transcript.
   */
  static buildSynthesisPrompt(
    session: any,
    report: any,
    candidateTurnsMap: Map<number, string>
  ): { systemPrompt: string; userPrompt: string } {
    const pillarScores = (report.pillarScores as PillarReportItem[]) || [];

    // Separate evaluated pillars from unevaluated pillars
    const evaluatedPillars = pillarScores.filter((p) => p.turnsEvaluated > 0 && p.score !== null);
    const unevaluatedPillars = pillarScores.filter((p) => p.turnsEvaluated === 0 || p.score === null);

    const demonstratedConcepts = evaluatedPillars.flatMap((p) => p.demonstratedConcepts || []);
    const identifiedGaps = evaluatedPillars.flatMap((p) => p.identifiedGaps || []);

    const systemPrompt = `You are an elite, highly rigorous Technical Interview Report Synthesizer.
Your role is to write grounded, evidence-based qualitative candidate feedback based SOLELY on the supplied deterministic assessment data and transcript.

STRICT GROUNDEDNESS RULES:
1. Treat deterministic report fields as immutable facts. Do NOT calculate alternative scores. Do NOT contradict them.
2. Only discuss skills, concepts, and technologies present in the supplied data.
3. Every strength and weakness MUST cite an actual candidate turn number (evidenceTurn: integer) and an EXACT substring quote (evidenceQuote: string) from that candidate turn.
4. If a point is general or evidence is insufficient, set evidenceTurn to null and evidenceQuote to null.
5. NEVER cite or quote an interviewer question.
6. NEVER claim that an unevaluated pillar was assessed. Unevaluated pillars have turnsEvaluated = 0.
7. Do NOT invent achievements, employment history, company names, or technical capabilities not in the transcript.
8. Output strictly valid JSON matching the required schema. You MUST include at least 1 item in strengths, at least 1 item in weaknesses (frame as advanced growth or edge-case handling if performance was exemplary), and at least 1 actionable tip. Never return empty arrays. No conversational prose.`;

    const userPrompt = `[DETERMINISTIC REPORT (AUTHORITATIVE & IMMUTABLE)]
- Session ID: ${session.id}
- Interview Track: ${session.type}
- Domain: ${session.domain || "General"}
- Focus Area: ${session.focusArea || "Comprehensive"}
- Overall Score: ${report.overallScore !== null ? report.overallScore + "/100" : "NOT ASSESSED"}
- Performance Level: ${report.overallPerformanceLevel || "NOT ASSESSED"}
- Starting Difficulty: ${report.startingDifficulty || "MID"}
- Final Difficulty: ${report.finalDifficulty || "MID"}

[EVALUATED PILLARS]
${
  evaluatedPillars.length > 0
    ? evaluatedPillars
        .map(
          (p) =>
            `- Pillar: ${p.name} (Slug: ${p.slug}) | Score: ${p.score}/100 | Mastery: ${p.masteryLevel || "N/A"} | Turns Evaluated: ${p.turnsEvaluated}`
        )
        .join("\n")
    : "No pillars were assessed substantive turns."
}

[UNEVALUATED PILLARS (DO NOT ASSESS OR INVENT CLAIMS FOR THESE)]
${
  unevaluatedPillars.length > 0
    ? unevaluatedPillars.map((p) => `- Pillar: ${p.name} (Slug: ${p.slug}) [UNEVALUATED]`).join("\n")
    : "None"
}

[DEMONSTRATED CONCEPTS]
${demonstratedConcepts.length > 0 ? demonstratedConcepts.map((c) => `- ${c}`).join("\n") : "None recorded"}

[IDENTIFIED GAPS & MISSING CONCEPTS]
${identifiedGaps.length > 0 ? identifiedGaps.map((g) => `- ${g}`).join("\n") : "None recorded"}

[CANDIDATE TRANSCRIPT (GROUNDING EVIDENCE)]
${Array.from(candidateTurnsMap.entries())
  .map(([turnNum, text]) => `Turn ${turnNum} [Candidate]: "${text.replace(/\n+/g, " ")}"`)
  .join("\n\n")}

[OUTPUT FORMAT]
Output strictly a JSON object with this exact structure:
{
  "executiveSummary": "<2-4 sentence executive overview summarizing observed performance aligned with overall score>",
  "strengths": [
    {
      "title": "<Concise strength title>",
      "description": "<Detailed explanation grounded in candidate's response>",
      "evidenceTurn": <turn integer or null>,
      "evidenceQuote": "<exact substring quote from candidate or null>"
    }
  ],
  "weaknesses": [
    {
      "title": "<Concise gap title>",
      "description": "<Detailed explanation of missing depth or tradeoff>",
      "evidenceTurn": <turn integer or null>,
      "evidenceQuote": "<exact substring quote from candidate or null>"
    }
  ],
  "actionableTips": [
    {
      "area": "<Specific technical topic>",
      "problem": "<Observed gap or limitation>",
      "specificAction": "<Concrete study topic, documentation, or practice exercise>",
      "whyItMatters": "<How this impacts production engineering or interview success>"
    }
  ]
}`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parses and validates raw LLM output against strict Zod schema.
   */
  static parseAndValidateSynthesisJSON(rawText: string): LLMReportSynthesis {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("LLM response did not contain a valid JSON object.");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr: any) {
      throw new Error(`Failed to parse LLM JSON: ${parseErr.message}`);
    }

    // Defensive normalization: Ensure arrays have at least 1 element to prevent schema failure on exemplary/sparse sessions
    if (!Array.isArray(parsed.strengths) || parsed.strengths.length === 0) {
      parsed.strengths = [
        {
          title: "Core Competency",
          description: "Candidate demonstrated foundational domain understanding during the session.",
          evidenceTurn: null,
          evidenceQuote: null,
        },
      ];
    }

    if (!Array.isArray(parsed.weaknesses) || parsed.weaknesses.length === 0) {
      parsed.weaknesses = [
        {
          title: "Advanced Optimization",
          description: "Further exploration of advanced production tradeoffs and edge-case handling is recommended.",
          evidenceTurn: null,
          evidenceQuote: null,
        },
      ];
    }

    if (!Array.isArray(parsed.actionableTips) || parsed.actionableTips.length === 0) {
      parsed.actionableTips = [
        {
          area: "Architecture Depth",
          problem: "Complex multi-variable systems require explicit tradeoff articulation.",
          specificAction: "Practice articulating non-functional requirements such as backpressure, idempotency, and partition strategy.",
          whyItMatters: "Senior roles emphasize architectural tradeoffs under unpredictable failure conditions.",
        },
      ];
    }

    return LLMReportSynthesisSchema.parse(parsed);
  }

  /**
   * Generates 100% deterministic synthesis for the APTITUDE track.
   * Zero conversational hallucination risk.
   */
  private static generateAptitudeSynthesis(
    session: any,
    report: any
  ): LLMReportSynthesis {
    const score = report.overallScore !== null ? Math.round(report.overallScore) : 0;
    const level = report.overallPerformanceLevel || "COMPETENT";

    const isHigh = score >= 75;
    const isMedium = score >= 50 && score < 75;

    return {
      executiveSummary: `The candidate completed the timed objective Aptitude assessment across Quantitative Ability, Logical Reasoning, and Verbal Ability, scoring ${score}%. Overall performance is classified as ${level}.`,
      strengths: [
        {
          title: isHigh ? "High Quantitative Accuracy" : "Foundational Problem Solving",
          description: isHigh
            ? "Demonstrated high accuracy and speed on arithmetic and analytical questions."
            : "Demonstrated solid understanding of fundamental logic and basic algebraic principles.",
          evidenceTurn: null,
          evidenceQuote: null,
        },
      ],
      weaknesses: [
        {
          title: isHigh ? "Advanced Optimization" : "Pacing & Complex Reasoning",
          description: isHigh
            ? "Minor opportunities exist to improve solution speed under tight time pressure."
            : "Encountered difficulty with multi-step word problems and speed calculation under timed constraints.",
          evidenceTurn: null,
          evidenceQuote: null,
        },
      ],
      actionableTips: [
        {
          area: "Speed Arithmetic",
          problem: "Solving multi-step calculations sequentially increases time per question.",
          specificAction: "Practice Vedic math and mental shortcuts for percentage and ratio calculations.",
          whyItMatters: "Rapid calculation reserves critical time for intricate logical deduction questions.",
        },
        {
          area: "Logical Deductions",
          problem: "Complex syllogisms require formal structuring.",
          specificAction: "Practice Venn diagram representations for categorical assertions.",
          whyItMatters: "Formal diagrams prevent false deductions in high-stakes reasoning problems.",
        },
      ],
    };
  }

  /**
   * Persists validated synthesis output to the InterviewReport row.
   *
   * ARCHITECTURAL INTEGRITY:
   * Only mutates synthesis fields. Deterministic scoring fields are NEVER touched.
   */
  private static async persistSynthesisOutput(
    reportId: string,
    synthesis: LLMReportSynthesis,
    modelName: string,
    prismaClient: typeof prisma | Prisma.TransactionClient
  ): Promise<void> {
    await prismaClient.interviewReport.update({
      where: { id: reportId },
      data: {
        synthesisStatus: "SYNTHESIS_READY",
        executiveSummary: synthesis.executiveSummary,
        structuredStrengths: synthesis.strengths as any,
        structuredWeaknesses: synthesis.weaknesses as any,
        structuredTips: synthesis.actionableTips as any,
        strengths: synthesis.strengths.map((s) => s.title) as any,
        weaknesses: synthesis.weaknesses.map((w) => w.title) as any,
        tips: synthesis.actionableTips.map((t) => `${t.area}: ${t.specificAction}`) as any,
        synthesisModel: modelName,
        synthesisPromptVersion: this.PROMPT_VERSION,
        synthesisCreatedAt: new Date(),
        synthesisUpdatedAt: new Date(),
        synthesisError: null,
      },
    });
  }
}
