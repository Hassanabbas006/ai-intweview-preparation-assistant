import { z } from "zod";
import { InterviewType } from "@prisma/client";
import {
  InterviewState,
  classifyCandidateMessage,
  isCandidateRequestingToEnd,
} from "@/lib/interview/state";
import {
  isCandidateClarification,
  isCandidateMetaInstruction,
  TECHNICAL_PILLARS,
  HR_PILLARS,
  MANAGERIAL_PILLARS,
} from "@/services/interview-engine";
import { getLLMProvider, LLMProvider, extractLLMErrorMessage } from "@/lib/llm";

// ============================================================================
// PHASE 3A TYPES & SCHEMAS
// ============================================================================

export type EvaluationStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "RETRYING"
  | "FAILED";

export type MasterySignal =
  | "MASTERY_HIGH"
  | "MASTERY_ADEQUATE"
  | "NEEDS_DEVELOPMENT"
  | "CRITICAL_GAP";

export type AdaptiveDifficultyAction = "INCREASE" | "MAINTAIN" | "DECREASE";

export const RubricScoreSchema = z.object({
  dimension: z.string().min(1),
  score: z.number().int().min(0).max(100),
  weight: z.number().min(0).max(1).default(1),
  evidenceSnippet: z.string().default(""),
  feedback: z.string().default(""),
});

export type RubricScore = z.infer<typeof RubricScoreSchema>;

export const TurnEvaluationSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  confidence: z.number().min(0.0).max(1.0).default(1.0),
  rubricScores: z.array(RubricScoreSchema).min(1),
  demonstratedConcepts: z.array(z.string()).default([]),
  missingConcepts: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  masterySignal: z.enum([
    "MASTERY_HIGH",
    "MASTERY_ADEQUATE",
    "NEEDS_DEVELOPMENT",
    "CRITICAL_GAP",
  ]),
  recommendedDifficulty: z.enum(["INCREASE", "MAINTAIN", "DECREASE"]).default("MAINTAIN"),
});

export type TurnEvaluation = z.infer<typeof TurnEvaluationSchema>;

export interface TurnEvaluationRecord {
  id: string;
  sessionId: string;
  turnSequenceNumber: number;
  pillarSlug: string;
  pillarName: string;
  evaluationStatus: EvaluationStatus;
  overallScore: number | null;
  confidence: number;
  rubricScores: RubricScore[] | null;
  demonstratedConcepts: string[];
  missingConcepts: string[];
  strengths: string[];
  weaknesses: string[];
  masterySignal: MasterySignal | null;
  recommendedDifficulty: AdaptiveDifficultyAction;
  evaluatorMetadata: {
    model: string;
    promptVersion: string;
    latencyMs: number;
    timestamp: string;
  };
  errorMessage: string | null;
}

export interface PillarMasteryState {
  pillarSlug: string;
  pillarName: string;
  rollingScore: number;
  totalSubstantiveTurns: number;
  consecutiveHighScoreTurns: number;
  consecutiveLowScoreTurns: number;
  masteryLevel: "NOVICE" | "DEVELOPING" | "COMPETENT" | "EXEMPLARY";
  demonstratedConcepts: string[];
  identifiedGaps: string[];
  lastEvaluatedTurnSequenceNumber: number;
}

export interface SessionMasteryState {
  sessionId: string;
  currentDifficulty: string;
  pillars: Record<string, PillarMasteryState>;
  evaluations: TurnEvaluationRecord[];
  updatedAt: Date | string;
}

export interface EvaluateTurnInput {
  sessionId: string;
  turnSequenceNumber: number;
  candidateMessage: string;
  pillarIndex: number;
  pillarName: string;
  pillarSlug?: string;
  roundType?: InterviewType;
  currentDifficulty?: string;
  previousHistory?: { role: string; content: string }[];
  llmProvider?: LLMProvider;
  timeoutMs?: number;
}

// Backward compatibility with Phase 1/2 stub
export interface EvaluationReportResult {
  scores: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  tips: string[];
}

export const DIFFICULTY_TIERS = ["JUNIOR", "MID", "SENIOR", "LEAD", "PRINCIPAL"];

// ============================================================================
// EVALUATOR IMPLEMENTATION
// ============================================================================

export class InterviewEvaluator {
  /**
   * Checks if candidate input should completely bypass the LLM evaluator (Fast-Path).
   * Non-substantive interactions, greetings, clarifications, and wrap-ups consume 0ms and $0 tokens.
   */
  static isFastPathBypass(
    candidateMessage: string,
    state?: InterviewState
  ): boolean {
    if (!candidateMessage || !candidateMessage.trim()) return true;
    if (state?.isCandidateEnding || isCandidateRequestingToEnd(candidateMessage)) return true;
    if (state?.isGreeting || classifyCandidateMessage(candidateMessage) === "GREETING") return true;
    if (isCandidateClarification(candidateMessage)) return true;
    if (isCandidateMetaInstruction(candidateMessage)) return true;
    if (classifyCandidateMessage(candidateMessage) === "NON_SUBSTANTIVE") return true;
    return false;
  }

  /**
   * Creates initial blank mastery state for a given pillar.
   */
  static createInitialPillarMastery(
    pillarSlug: string,
    pillarName: string
  ): PillarMasteryState {
    return {
      pillarSlug,
      pillarName,
      rollingScore: 0,
      totalSubstantiveTurns: 0,
      consecutiveHighScoreTurns: 0,
      consecutiveLowScoreTurns: 0,
      masteryLevel: "DEVELOPING",
      demonstratedConcepts: [],
      identifiedGaps: [],
      lastEvaluatedTurnSequenceNumber: 0,
    };
  }

  /**
   * Deterministic evaluation for the Aptitude track (100% deterministic, 0 LLM calls).
   */
  static evaluateAptitudeAnswer(
    selectedOption: string | number,
    correctOption: string | number,
    questionCategory: string = "Aptitude",
    turnSequenceNumber: number = 1
  ): TurnEvaluationRecord {
    const isCorrect =
      String(selectedOption).trim().toLowerCase() ===
      String(correctOption).trim().toLowerCase();
    const score = isCorrect ? 100 : 0;

    return {
      id: `eval_aptitude_seq_${turnSequenceNumber}`,
      sessionId: "aptitude_session",
      turnSequenceNumber,
      pillarSlug: "APTITUDE",
      pillarName: questionCategory,
      evaluationStatus: "COMPLETED",
      overallScore: score,
      confidence: 1.0,
      rubricScores: [
        {
          dimension: "Accuracy",
          score,
          weight: 1.0,
          evidenceSnippet: `Selected: ${selectedOption} | Correct: ${correctOption}`,
          feedback: isCorrect
            ? "Accurate answer selection."
            : "Incorrect answer selection.",
        },
      ],
      demonstratedConcepts: isCorrect ? [questionCategory] : [],
      missingConcepts: isCorrect ? [] : [questionCategory],
      strengths: isCorrect ? ["Accurate logical problem solving"] : [],
      weaknesses: isCorrect ? [] : ["Incorrect answer chosen"],
      masterySignal: isCorrect ? "MASTERY_HIGH" : "CRITICAL_GAP",
      recommendedDifficulty: isCorrect ? "INCREASE" : "DECREASE",
      evaluatorMetadata: {
        model: "deterministic-rule-engine",
        promptVersion: "phase-3a-v1",
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      },
      errorMessage: null,
    };
  }

  /**
   * Updates PillarMasteryState using Exponential Moving Average (EMA, alpha=0.65)
   * and tracks consecutive high/low scoring streaks for hysteresis.
   *
   * ZERO-FABRICATION RULE: If evaluation failed or score is null, returns state UNCHANGED.
   */
  static updatePillarMastery(
    currentMastery: PillarMasteryState,
    evaluation: TurnEvaluationRecord
  ): PillarMasteryState {
    // 1. Guard against evaluator failure: never update mastery with fabricated scores
    if (
      evaluation.evaluationStatus === "FAILED" ||
      evaluation.overallScore === null
    ) {
      return { ...currentMastery };
    }

    // 2. Reject duplicate / stale out-of-order evaluations from corrupting rolling scores
    if (
      evaluation.turnSequenceNumber <=
      currentMastery.lastEvaluatedTurnSequenceNumber
    ) {
      const mergedDemonstrated = Array.from(
        new Set([
          ...currentMastery.demonstratedConcepts,
          ...evaluation.demonstratedConcepts,
        ])
      );
      const mergedGaps = Array.from(
        new Set([
          ...currentMastery.identifiedGaps,
          ...evaluation.missingConcepts,
        ])
      );
      return {
        ...currentMastery,
        demonstratedConcepts: mergedDemonstrated,
        identifiedGaps: mergedGaps,
      };
    }

    const score = evaluation.overallScore;
    const isFirstSubstantiveTurn = currentMastery.totalSubstantiveTurns === 0;
    const alpha = 0.65;

    // Exponential Moving Average calculation
    const rollingScore = isFirstSubstantiveTurn
      ? score
      : Math.round(alpha * score + (1 - alpha) * currentMastery.rollingScore);

    // Update streak counters
    let consecutiveHigh = currentMastery.consecutiveHighScoreTurns;
    let consecutiveLow = currentMastery.consecutiveLowScoreTurns;

    if (score >= 85 && evaluation.masterySignal === "MASTERY_HIGH") {
      consecutiveHigh += 1;
      consecutiveLow = 0;
    } else if (score <= 45 && evaluation.masterySignal === "CRITICAL_GAP") {
      consecutiveLow += 1;
      consecutiveHigh = 0;
    } else {
      consecutiveHigh = 0;
      consecutiveLow = 0;
    }

    // Compute qualitative mastery level
    let masteryLevel: "NOVICE" | "DEVELOPING" | "COMPETENT" | "EXEMPLARY" = "DEVELOPING";
    if (rollingScore >= 85) {
      masteryLevel = "EXEMPLARY";
    } else if (rollingScore >= 70) {
      masteryLevel = "COMPETENT";
    } else if (rollingScore >= 46) {
      masteryLevel = "DEVELOPING";
    } else {
      masteryLevel = "NOVICE";
    }

    const mergedDemonstrated = Array.from(
      new Set([
        ...currentMastery.demonstratedConcepts,
        ...evaluation.demonstratedConcepts,
      ])
    );
    const mergedGaps = Array.from(
      new Set([
        ...currentMastery.identifiedGaps,
        ...evaluation.missingConcepts,
      ])
    );

    return {
      pillarSlug: currentMastery.pillarSlug,
      pillarName: currentMastery.pillarName,
      rollingScore,
      totalSubstantiveTurns: currentMastery.totalSubstantiveTurns + 1,
      consecutiveHighScoreTurns: consecutiveHigh,
      consecutiveLowScoreTurns: consecutiveLow,
      masteryLevel,
      demonstratedConcepts: mergedDemonstrated,
      identifiedGaps: mergedGaps,
      lastEvaluatedTurnSequenceNumber: evaluation.turnSequenceNumber,
    };
  }

  /**
   * Calculates adaptive difficulty using a 2-turn hysteresis engine.
   * Requires 2 consecutive confirmed high/low substantive turns with qualifying mastery signals to shift tiers.
   * Clamped to: JUNIOR <= difficulty <= PRINCIPAL (Max +/- 1 tier per adaptation).
   */
  static calculateAdaptiveDifficulty(
    currentDifficulty: string,
    consecutiveHighTurns: number,
    consecutiveLowTurns: number
  ): { nextLevel: string; action: AdaptiveDifficultyAction } {
    let normalized = (currentDifficulty || "MID").toUpperCase();
    if (normalized === "INTERMEDIATE") {
      normalized = "MID";
    }
    const currentIndex = DIFFICULTY_TIERS.indexOf(normalized);
    const validIndex = currentIndex >= 0 ? currentIndex : 1; // Default to MID (index 1)

    if (consecutiveHighTurns >= 2) {
      const nextIndex = Math.min(validIndex + 1, DIFFICULTY_TIERS.length - 1);
      return {
        nextLevel: DIFFICULTY_TIERS[nextIndex],
        action: nextIndex > validIndex ? "INCREASE" : "MAINTAIN",
      };
    }

    if (consecutiveLowTurns >= 2) {
      const nextIndex = Math.max(validIndex - 1, 0);
      return {
        nextLevel: DIFFICULTY_TIERS[nextIndex],
        action: nextIndex < validIndex ? "DECREASE" : "MAINTAIN",
      };
    }

    return {
      nextLevel: DIFFICULTY_TIERS[validIndex],
      action: "MAINTAIN",
    };
  }

  /**
   * Evaluates a single candidate turn.
   * Returns a structured TurnEvaluationRecord.
   *
   * On failure, timeout, or schema error:
   * Returns evaluationStatus = 'FAILED', overallScore = null, and ZERO fabricated numbers.
   */
  static async evaluateTurn(input: EvaluateTurnInput): Promise<TurnEvaluationRecord> {
    const startTime = Date.now();
    const {
      sessionId,
      turnSequenceNumber,
      candidateMessage,
      pillarIndex,
      pillarName,
      pillarSlug = `PILLAR-${pillarIndex}`,
      currentDifficulty = "INTERMEDIATE",
      roundType = "DOMAIN",
      llmProvider,
      timeoutMs = 5000,
    } = input;

    // Fast-path bypass check
    if (this.isFastPathBypass(candidateMessage)) {
      return {
        id: `eval_${sessionId}_t${turnSequenceNumber}`,
        sessionId,
        turnSequenceNumber,
        pillarSlug,
        pillarName,
        evaluationStatus: "COMPLETED",
        overallScore: null,
        confidence: 1.0,
        rubricScores: null,
        demonstratedConcepts: [],
        missingConcepts: [],
        strengths: [],
        weaknesses: [],
        masterySignal: null,
        recommendedDifficulty: "MAINTAIN",
        evaluatorMetadata: {
          model: "fast-path-filter",
          promptVersion: "phase-3a-v1",
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        errorMessage: null,
      };
    }

    const provider = llmProvider || getLLMProvider();

    const evaluationSystemPrompt = `You are a Senior Technical Hiring Bar Evaluator.
Analyze the candidate's technical response for the specified interview topic pillar.
Assess architectural depth, trade-off awareness, concrete specifics, and missing concepts.
Keep feedback and evidence snippets concise (1-2 sentences each).

Output ONLY valid JSON matching this exact schema:
{
  "overallScore": <integer 0-100>,
  "confidence": <float 0.0-1.0>,
  "rubricScores": [
    {
      "dimension": "<dimension name>",
      "score": <integer 0-100>,
      "weight": 1.0,
      "evidenceSnippet": "<direct phrase or detail from candidate>",
      "feedback": "<concise analytical assessment>"
    }
  ],
  "demonstratedConcepts": ["<concept1>", "<concept2>"],
  "missingConcepts": ["<gap1>", "<gap2>"],
  "strengths": ["<strength1>"],
  "weaknesses": ["<weakness1>"],
  "masterySignal": "<MASTERY_HIGH | MASTERY_ADEQUATE | NEEDS_DEVELOPMENT | CRITICAL_GAP>",
  "recommendedDifficulty": "<INCREASE | MAINTAIN | DECREASE>"
}

Score Guidelines:
- 85-100 (MASTERY_HIGH): Deep technical mastery, proactive trade-offs, concrete implementation details.
- 70-84 (MASTERY_ADEQUATE): Competent answer, standard patterns, minor missing edge cases.
- 46-69 (NEEDS_DEVELOPMENT): High-level or surface-level familiarity, lacks depth or concrete tradeoffs.
- 0-45 (CRITICAL_GAP): Inaccurate concepts, severe misunderstandings, or unable to address core question.`;

    const userPrompt = `INTERVIEW CONTEXT:
Round Type: ${roundType}
Active Pillar: ${pillarName} (Pillar Index: ${pillarIndex})
Target Difficulty Tier: ${currentDifficulty}

CANDIDATE RESPONSE TO EVALUATE:
"${candidateMessage}"

Evaluate the candidate's response against the rubric criteria for ${pillarName}. Output strictly JSON.`;

    try {
      let timeoutHandle: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`Evaluator LLM request timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      });

      const completionPromise = provider.generateText({
        messages: [{ role: "user", content: userPrompt }],
        systemInstruction: evaluationSystemPrompt,
        temperature: 0.2,
        maxOutputTokens: 1200,
      });

      const rawResponse = await Promise.race([completionPromise, timeoutPromise]);
      if (timeoutHandle) clearTimeout(timeoutHandle);

      // Clean and extract JSON object
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : rawResponse.trim();

      const parsed = JSON.parse(cleanJson);
      const validated = TurnEvaluationSchema.parse(parsed);

      return {
        id: `eval_${sessionId}_t${turnSequenceNumber}`,
        sessionId,
        turnSequenceNumber,
        pillarSlug,
        pillarName,
        evaluationStatus: "COMPLETED",
        overallScore: validated.overallScore,
        confidence: validated.confidence,
        rubricScores: validated.rubricScores,
        demonstratedConcepts: validated.demonstratedConcepts,
        missingConcepts: validated.missingConcepts,
        strengths: validated.strengths,
        weaknesses: validated.weaknesses,
        masterySignal: validated.masterySignal,
        recommendedDifficulty: validated.recommendedDifficulty,
        evaluatorMetadata: {
          model: provider.name,
          promptVersion: "phase-3a-v1",
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        errorMessage: null,
      };
    } catch (err: any) {
      const errorMsg = extractLLMErrorMessage(err);
      console.warn(`[Evaluator Error - Turn ${turnSequenceNumber}]: ${errorMsg}`);

      // ZERO-FABRICATION FAILURE RETURN: score = null, status = FAILED
      return {
        id: `eval_${sessionId}_t${turnSequenceNumber}`,
        sessionId,
        turnSequenceNumber,
        pillarSlug,
        pillarName,
        evaluationStatus: "FAILED",
        overallScore: null,
        confidence: 0,
        rubricScores: null,
        demonstratedConcepts: [],
        missingConcepts: [],
        strengths: [],
        weaknesses: [],
        masterySignal: null,
        recommendedDifficulty: "MAINTAIN",
        evaluatorMetadata: {
          model: provider.name,
          promptVersion: "phase-3a-v1",
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        errorMessage: errorMsg,
      };
    }
  }
}
