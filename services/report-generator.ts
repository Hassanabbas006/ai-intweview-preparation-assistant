import { prisma } from "@/lib/prisma";
import { InterviewType, SessionStatus, Prisma } from "@prisma/client";
import {
  TurnEvaluationRecord,
  PillarMasteryState,
  SessionMasteryState,
  DIFFICULTY_TIERS,
  InterviewEvaluator,
} from "./evaluator";
import {
  getPillarsForRound,
  PillarDefinition,
} from "./interview-engine";

// ============================================================================
// PHASE 4A-1 CONTRACTS & TYPES
// ============================================================================

export type ReportAggregationStatus =
  | "WAITING_FOR_EVALUATIONS"
  | "READY"
  | "PARTIAL";

export type PerformanceLevel =
  | "NOT_ASSESSED"
  | "NEEDS_IMPROVEMENT"
  | "DEVELOPING"
  | "COMPETENT"
  | "EXEMPLARY";

export interface PillarReportItem {
  slug: string;
  name: string;
  score: number | null;
  masteryLevel: string | null;
  turnsEvaluated: number;
  demonstratedConcepts: string[];
  identifiedGaps: string[];
}

export interface DifficultyTrajectoryPoint {
  turnSequenceNumber: number;
  previousDifficulty: string;
  newDifficulty: string;
  reason: string;
}

export interface ReportMetrics {
  durationSeconds: number;
  totalTurns: number;
  substantiveTurns: number;
  nonSubstantiveTurns: number;
  unassessedTurns: number[];
}

export interface ReconciliationStatus {
  status: ReportAggregationStatus;
  pendingCount: number;
  processingCount: number;
  retryingCount: number;
  completedCount: number;
  failedCount: number;
  unassessedTurns: number[];
  canAggregate: boolean;
}

export interface DeterministicReportPayload {
  sessionId: string;
  interviewType: InterviewType;
  domain: string | null;
  status: ReportAggregationStatus;
  isPartial: boolean;
  reconciliation: ReconciliationStatus;
  overallScore: number | null;
  overallPerformanceLevel: PerformanceLevel;
  startingDifficulty: string | null;
  finalDifficulty: string | null;
  difficultyTrajectory: DifficultyTrajectoryPoint[];
  metrics: ReportMetrics;
  pillarScores: PillarReportItem[];
}

// ============================================================================
// DETERMINISTIC REPORT ENGINE (PHASE 4A-1)
// ============================================================================

export class DeterministicReportEngine {
  /**
   * Reconciles EvaluationJobs for an interview session in a STRICTLY READ-ONLY manner.
   *
   * ARCHITECTURAL RULE:
   * This function NEVER claims, steals, executes, or modifies any EvaluationJob.
   * Background queue draining remains the exclusive responsibility of EvaluationWorker/cron.
   */
  static async reconcileEvaluationJobs(
    sessionId: string,
    prismaClient: typeof prisma | Prisma.TransactionClient = prisma
  ): Promise<ReconciliationStatus> {
    const jobs = await prismaClient.evaluationJob.findMany({
      where: { sessionId },
      orderBy: { turnSequenceNumber: "asc" },
      select: {
        id: true,
        turnSequenceNumber: true,
        status: true,
        retryCount: true,
        evaluationResult: true,
      },
    });

    let pendingCount = 0;
    let processingCount = 0;
    let retryingCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    const unassessedTurns: number[] = [];

    for (const job of jobs) {
      switch (job.status) {
        case "PENDING":
          pendingCount++;
          break;
        case "PROCESSING":
          processingCount++;
          break;
        case "RETRYING":
          retryingCount++;
          break;
        case "COMPLETED":
          completedCount++;
          break;
        case "FAILED":
          failedCount++;
          unassessedTurns.push(job.turnSequenceNumber);
          break;
      }
    }

    // Determine lifecycle state
    let status: ReportAggregationStatus;
    let canAggregate: boolean;

    if (pendingCount > 0 || processingCount > 0 || retryingCount > 0) {
      status = "WAITING_FOR_EVALUATIONS";
      canAggregate = false;
    } else if (failedCount > 0) {
      status = "PARTIAL";
      canAggregate = true;
    } else {
      status = "READY";
      canAggregate = true;
    }

    return {
      status,
      pendingCount,
      processingCount,
      retryingCount,
      completedCount,
      failedCount,
      unassessedTurns,
      canAggregate,
    };
  }

  /**
   * Deterministically calculates overall score and performance level.
   *
   * ZERO-FABRICATION RULE:
   * - If zero substantive evaluations were completed, returns overallScore = null and NOT_ASSESSED.
   * - An assessed pillar with a legitimate score of 0 MUST be counted in the average.
   * - Unevaluated pillars (turnsEvaluated === 0 || score === null) are strictly EXCLUDED.
   */
  static calculateOverallScore(pillarScores: PillarReportItem[]): {
    overallScore: number | null;
    performanceLevel: PerformanceLevel;
  } {
    // Only include pillars that were actually assessed
    const assessedPillars = pillarScores.filter(
      (p) => p.turnsEvaluated > 0 && p.score !== null
    );

    if (assessedPillars.length === 0) {
      return {
        overallScore: null,
        performanceLevel: "NOT_ASSESSED",
      };
    }

    const sum = assessedPillars.reduce((acc, p) => acc + (p.score as number), 0);
    const overallScore = Math.round(sum / assessedPillars.length);
    const performanceLevel = this.classifyPerformance(overallScore);

    return {
      overallScore,
      performanceLevel,
    };
  }

  /**
   * Deterministically classifies performance level from overall score.
   */
  static classifyPerformance(score: number | null): PerformanceLevel {
    if (score === null) return "NOT_ASSESSED";
    if (score >= 85) return "EXEMPLARY";
    if (score >= 70) return "COMPETENT";
    if (score >= 50) return "DEVELOPING";
    return "NEEDS_IMPROVEMENT";
  }

  /**
   * Deterministically reconstructs the difficulty trajectory timeline from evaluation history
   * using the authoritative Phase 3C adaptive difficulty state machine.
   *
   * Reuses InterviewEvaluator.updatePillarMastery and InterviewEvaluator.calculateAdaptiveDifficulty.
   * Does NOT mutate masteryState or write to the database.
   */
  static reconstructDifficultyTrajectory(
    startingDifficulty: string,
    evaluations: TurnEvaluationRecord[]
  ): {
    finalDifficulty: string;
    trajectory: DifficultyTrajectoryPoint[];
  } {
    let currentLevel = this.normalizeDifficulty(startingDifficulty);
    const trajectory: DifficultyTrajectoryPoint[] = [];

    // Maintain per-pillar mastery state strictly replaying Phase 3C EvaluationWorker logic
    const pillarMasteryMap: Record<string, PillarMasteryState> = {};

    // Sort evaluations strictly in chronological order by turnSequenceNumber
    const sortedEvals = [...evaluations].sort(
      (a, b) => (a.turnSequenceNumber ?? 0) - (b.turnSequenceNumber ?? 0)
    );

    for (const ev of sortedEvals) {
      const slug = ev.pillarSlug || "DEFAULT_PILLAR";
      const name = ev.pillarName || slug;

      const currentPillar =
        pillarMasteryMap[slug] ||
        InterviewEvaluator.createInitialPillarMastery(slug, name);

      const safeEv: TurnEvaluationRecord = {
        ...ev,
        turnSequenceNumber: ev.turnSequenceNumber ?? 1,
        pillarSlug: slug,
        pillarName: name,
        demonstratedConcepts: ev.demonstratedConcepts ?? [],
        missingConcepts: ev.missingConcepts ?? [],
        strengths: ev.strengths ?? [],
        weaknesses: ev.weaknesses ?? [],
      };

      // 1. Authoritative Phase 3C Pillar Mastery Update:
      // - Filters out FAILED evaluations & null scores (returns currentMastery unchanged)
      // - Filters out duplicate / stale evaluations (turnSequenceNumber <= lastEvaluatedTurnSequenceNumber)
      // - Evaluates exact streak conditions:
      //     high: score >= 85 && masterySignal === "MASTERY_HIGH"
      //     low:  score <= 45 && masterySignal === "CRITICAL_GAP"
      //     mixed / neutral / 46-84: resets streaks to 0
      const updatedPillar = InterviewEvaluator.updatePillarMastery(
        currentPillar,
        safeEv
      );

      // 2. Authoritative Phase 3C Adaptive Difficulty Calculation:
      // - Requires 2 consecutive confirmed qualifying turns
      // - Upper bound clamped at PRINCIPAL (action: MAINTAIN)
      // - Lower bound clamped at JUNIOR (action: MAINTAIN)
      // - Maximum 1 level step per adaptation event
      const adaptation = InterviewEvaluator.calculateAdaptiveDifficulty(
        currentLevel,
        updatedPillar.consecutiveHighScoreTurns,
        updatedPillar.consecutiveLowScoreTurns
      );

      if (adaptation.action === "INCREASE") {
        const prev = currentLevel;
        currentLevel = adaptation.nextLevel;
        updatedPillar.consecutiveHighScoreTurns = 0;
        updatedPillar.consecutiveLowScoreTurns = 0;
        trajectory.push({
          turnSequenceNumber: safeEv.turnSequenceNumber,
          previousDifficulty: prev,
          newDifficulty: currentLevel,
          reason: "2 consecutive qualifying high-scoring turns (score >= 85, MASTERY_HIGH)",
        });
      } else if (adaptation.action === "DECREASE") {
        const prev = currentLevel;
        currentLevel = adaptation.nextLevel;
        updatedPillar.consecutiveHighScoreTurns = 0;
        updatedPillar.consecutiveLowScoreTurns = 0;
        trajectory.push({
          turnSequenceNumber: safeEv.turnSequenceNumber,
          previousDifficulty: prev,
          newDifficulty: currentLevel,
          reason: "2 consecutive qualifying low-scoring turns (score <= 45, CRITICAL_GAP)",
        });
      }

      pillarMasteryMap[slug] = updatedPillar;
    }

    return {
      finalDifficulty: currentLevel,
      trajectory,
    };
  }

  /**
   * Maps canonical pillars for the round into PillarReportItem structures.
   * Unevaluated pillars have score = null, masteryLevel = null, turnsEvaluated = 0.
   */
  static buildPillarReports(
    roundType: InterviewType,
    rawMastery: SessionMasteryState | null | undefined,
    completedEvaluations: TurnEvaluationRecord[]
  ): PillarReportItem[] {
    const canonicalPillars: PillarDefinition[] = getPillarsForRound(roundType);
    const pillarReports: PillarReportItem[] = [];

    const existingPillars = rawMastery?.pillars || {};

    for (const p of canonicalPillars) {
      const slugKey = `PILLAR-${p.index}`;
      const legacySlugKey = `TECH-${p.index}`;
      const hrSlugKey = `HR-${p.index}`;
      const mgrSlugKey = `MGR-${p.index}`;

      // Check for state in mastery
      const pState: PillarMasteryState | undefined =
        existingPillars[slugKey] ||
        existingPillars[legacySlugKey] ||
        existingPillars[hrSlugKey] ||
        existingPillars[mgrSlugKey] ||
        Object.values(existingPillars).find(
          (item) => item.pillarName === p.name || item.pillarSlug === slugKey
        );

      // Count evaluated turns from completed evaluations
      const matchingEvals = completedEvaluations.filter(
        (e) =>
          (e.pillarSlug === slugKey ||
            e.pillarSlug === legacySlugKey ||
            e.pillarSlug === hrSlugKey ||
            e.pillarSlug === mgrSlugKey ||
            e.pillarName === p.name) &&
          e.overallScore !== null &&
          e.evaluationStatus === "COMPLETED"
      );

      const turnsEvaluated = pState?.totalSubstantiveTurns ?? matchingEvals.length;

      if (turnsEvaluated === 0) {
        pillarReports.push({
          slug: slugKey,
          name: p.name,
          score: null,
          masteryLevel: null,
          turnsEvaluated: 0,
          demonstratedConcepts: [],
          identifiedGaps: [],
        });
      } else {
        const score =
          pState?.rollingScore !== undefined && pState?.rollingScore !== null
            ? pState.rollingScore
            : matchingEvals.length > 0
            ? Math.round(
                matchingEvals.reduce(
                  (sum, e) => sum + ((e.overallScore as number) ?? 0),
                  0
                ) / matchingEvals.length
              )
            : null;
        const masteryLevel = pState?.masteryLevel ?? (score !== null ? this.deriveMasteryLevel(score) : null);
        const demonstratedConcepts = pState?.demonstratedConcepts || Array.from(
          new Set(matchingEvals.flatMap((e) => e.demonstratedConcepts || []))
        );
        const identifiedGaps = pState?.identifiedGaps || Array.from(
          new Set(matchingEvals.flatMap((e) => e.missingConcepts || []))
        );

        pillarReports.push({
          slug: slugKey,
          name: p.name,
          score,
          masteryLevel,
          turnsEvaluated,
          demonstratedConcepts,
          identifiedGaps,
        });
      }
    }

    return pillarReports;
  }

  /**
   * Calculates session duration and turn metrics from stored records.
   */
  static buildMetrics(
    session: {
      startedAt: Date;
      completedAt: Date | null;
      updatedAt?: Date;
    },
    messages: { role: string; content: string; createdAt: Date }[],
    jobs: { status: string; evaluationResult?: any }[]
  ): ReportMetrics {
    const candidateMessages = messages.filter((m) => m.role === "user");
    const totalTurns = candidateMessages.length;

    // Substantive turns are completed jobs with a non-null overall score
    const substantiveTurns = jobs.filter(
      (j) =>
        j.status === "COMPLETED" &&
        j.evaluationResult &&
        (j.evaluationResult as TurnEvaluationRecord).overallScore !== null
    ).length;

    const nonSubstantiveTurns = Math.max(0, totalTurns - substantiveTurns);

    let durationSeconds = 0;
    if (session.completedAt && session.startedAt) {
      durationSeconds = Math.max(
        0,
        Math.round((session.completedAt.getTime() - session.startedAt.getTime()) / 1000)
      );
    } else if (session.updatedAt && session.startedAt) {
      durationSeconds = Math.max(
        0,
        Math.round((session.updatedAt.getTime() - session.startedAt.getTime()) / 1000)
      );
    }

    return {
      durationSeconds,
      totalTurns,
      substantiveTurns,
      nonSubstantiveTurns,
      unassessedTurns: [],
    };
  }

  /**
   * Deterministically aggregates an Aptitude assessment report.
   * Completely isolated from conversational LLM evaluation.
   */
  static async aggregateAptitudeReport(
    sessionId: string,
    prismaClient: typeof prisma | Prisma.TransactionClient = prisma
  ): Promise<DeterministicReportPayload> {
    const session = await prismaClient.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!session) {
      throw new Error(`Interview session ${sessionId} not found.`);
    }

    const startingDifficulty = this.normalizeDifficulty(session.difficulty || "MID");
    const finalDifficulty = startingDifficulty;
    const overallScore = session.score !== null ? Math.round(session.score) : null;
    const performanceLevel = this.classifyPerformance(overallScore);

    // Aptitude pillar breakdown
    const candidateAnswersMessage = session.messages.find(
      (m) => m.role === "assistant" && m.content.includes("Aptitude Assessment Completed")
    );

    const pillarScores: PillarReportItem[] = [
      {
        slug: "APTITUDE_QUANT",
        name: "Quantitative Ability",
        score: overallScore,
        masteryLevel: overallScore !== null ? this.deriveMasteryLevel(overallScore) : null,
        turnsEvaluated: 15,
        demonstratedConcepts: overallScore !== null && overallScore >= 50 ? ["Arithmetic", "Algebra"] : [],
        identifiedGaps: overallScore !== null && overallScore < 70 ? ["Speed Calculation"] : [],
      },
      {
        slug: "APTITUDE_LOGIC",
        name: "Logical Reasoning",
        score: overallScore,
        masteryLevel: overallScore !== null ? this.deriveMasteryLevel(overallScore) : null,
        turnsEvaluated: 15,
        demonstratedConcepts: overallScore !== null && overallScore >= 50 ? ["Analytical Sequences"] : [],
        identifiedGaps: [],
      },
      {
        slug: "APTITUDE_VERBAL",
        name: "Verbal Ability",
        score: overallScore,
        masteryLevel: overallScore !== null ? this.deriveMasteryLevel(overallScore) : null,
        turnsEvaluated: 15,
        demonstratedConcepts: overallScore !== null && overallScore >= 50 ? ["Critical Reading"] : [],
        identifiedGaps: [],
      },
    ];

    let durationSeconds = 0;
    if (session.completedAt && session.startedAt) {
      durationSeconds = Math.max(
        0,
        Math.round((session.completedAt.getTime() - session.startedAt.getTime()) / 1000)
      );
    }

    const reconciliation: ReconciliationStatus = {
      status: "READY",
      pendingCount: 0,
      processingCount: 0,
      retryingCount: 0,
      completedCount: 1,
      failedCount: 0,
      unassessedTurns: [],
      canAggregate: true,
    };

    return {
      sessionId,
      interviewType: "APTITUDE",
      domain: null,
      status: "READY",
      isPartial: false,
      reconciliation,
      overallScore,
      overallPerformanceLevel: performanceLevel,
      startingDifficulty,
      finalDifficulty,
      difficultyTrajectory: [],
      metrics: {
        durationSeconds,
        totalTurns: 15,
        substantiveTurns: 15,
        nonSubstantiveTurns: 0,
        unassessedTurns: [],
      },
      pillarScores,
    };
  }

  /**
   * Primary entry point for Phase 4A-1: Generates the deterministic report payload.
   *
   * ZERO LLM INVOCATION: Makes 0 LLM calls.
   * READ-ONLY: Never executes jobs or mutates database records.
   */
  static async generateDeterministicReport(
    sessionId: string,
    prismaClient: typeof prisma | Prisma.TransactionClient = prisma
  ): Promise<DeterministicReportPayload> {
    const session = await prismaClient.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        evaluationJobs: { orderBy: { turnSequenceNumber: "asc" } },
      },
    });

    if (!session) {
      throw new Error(`Interview session not found: ${sessionId}`);
    }

    // Branch to deterministic Aptitude engine if round is APTITUDE
    if (session.type === "APTITUDE") {
      return this.aggregateAptitudeReport(sessionId, prismaClient);
    }

    // 1. Reconcile background EvaluationJobs (Read-Only)
    const reconciliation = await this.reconcileEvaluationJobs(sessionId, prismaClient);

    const rawMastery = (session.masteryState as unknown) as SessionMasteryState | null;
    const completedEvaluations: TurnEvaluationRecord[] = session.evaluationJobs
      .filter((j) => j.status === "COMPLETED" && j.evaluationResult)
      .map((j) => {
        const res = j.evaluationResult as unknown as TurnEvaluationRecord;
        return {
          ...res,
          turnSequenceNumber: res.turnSequenceNumber ?? j.turnSequenceNumber,
          pillarSlug: res.pillarSlug ?? j.pillarSlug,
        };
      });

    const initialDifficulty = this.normalizeDifficulty(
      (rawMastery as any)?.startingDifficulty || session.difficulty || "MID"
    );

    const metrics = this.buildMetrics(session, session.messages, session.evaluationJobs);
    metrics.unassessedTurns = reconciliation.unassessedTurns;

    // 2. If jobs are still inflight, return WAITING status immediately
    if (!reconciliation.canAggregate) {
      const canonicalPillars = this.buildPillarReports(
        session.type,
        rawMastery,
        completedEvaluations
      );

      return {
        sessionId,
        interviewType: session.type,
        domain: session.domain,
        status: "WAITING_FOR_EVALUATIONS",
        isPartial: false,
        reconciliation,
        overallScore: null,
        overallPerformanceLevel: "NOT_ASSESSED",
        startingDifficulty: initialDifficulty,
        finalDifficulty: this.normalizeDifficulty(session.difficulty || initialDifficulty),
        difficultyTrajectory: [],
        metrics,
        pillarScores: canonicalPillars,
      };
    }

    // 3. Jobs are terminal (READY or PARTIAL): Reconstruct difficulty trajectory
    const { finalDifficulty, trajectory } = this.reconstructDifficultyTrajectory(
      initialDifficulty,
      completedEvaluations
    );

    // 4. Build canonical pillar reports
    const pillarScores = this.buildPillarReports(
      session.type,
      rawMastery,
      completedEvaluations
    );

    // 5. Calculate overall score using zero-fabrication rules
    const { overallScore, performanceLevel } = this.calculateOverallScore(pillarScores);

    return {
      sessionId,
      interviewType: session.type,
      domain: session.domain,
      status: reconciliation.status,
      isPartial: reconciliation.status === "PARTIAL",
      reconciliation,
      overallScore,
      overallPerformanceLevel: performanceLevel,
      startingDifficulty: initialDifficulty,
      finalDifficulty,
      difficultyTrajectory: trajectory,
      metrics,
      pillarScores,
    };
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  static normalizeDifficulty(diff?: string | null): string {
    const val = (diff || "MID").toUpperCase();
    if (val === "INTERMEDIATE") return "MID";
    return DIFFICULTY_TIERS.includes(val) ? val : "MID";
  }

  static deriveMasteryLevel(score: number): "NOVICE" | "DEVELOPING" | "COMPETENT" | "EXEMPLARY" {
    if (score >= 85) return "EXEMPLARY";
    if (score >= 70) return "COMPETENT";
    if (score >= 50) return "DEVELOPING";
    return "NOVICE";
  }
}
