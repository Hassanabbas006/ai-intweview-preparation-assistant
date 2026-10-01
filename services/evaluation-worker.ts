import { prisma } from "@/lib/prisma";
import {
  InterviewEvaluator,
  TurnEvaluationRecord,
  PillarMasteryState,
  SessionMasteryState,
} from "@/services/evaluator";
import { LLMProvider, getLLMProvider, extractLLMErrorMessage } from "@/lib/llm";
import { EvaluationJobStatus, Prisma } from "@prisma/client";

// ============================================================================
// EVALUATION WORKER TYPES & CONFIGURATION
// ============================================================================

export interface EvaluationJobData {
  id: string;
  idempotencyKey: string;
  sessionId: string;
  turnSequenceNumber: number;
  pillarSlug: string;
  candidateMessage: string;
  contextHistory: any;
  status: EvaluationJobStatus;
  workerId: string | null;
  claimedAt: Date | null;
  leaseExpiresAt: Date | null;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  nextRetryAt: Date | null;
  evaluationResult: any | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEvaluationJobInput {
  sessionId: string;
  turnSequenceNumber: number;
  pillarSlug: string;
  candidateMessage: string;
  contextHistory?: Array<{ role: string; content: string }>;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface ClaimJobOptions {
  workerId?: string;
  leaseDurationMs?: number; // default: 60000ms (60s)
  prismaClient?: typeof prisma;
}

export interface ProcessJobOptions {
  llmProvider?: LLMProvider;
  timeoutMs?: number;
  prismaClient?: typeof prisma;
}

export interface ProcessAllOptions extends ProcessJobOptions {
  batchSize?: number;
  workerId?: string;
  leaseDurationMs?: number;
  maxDurationMs?: number;
}

// ============================================================================
// DURABLE EVALUATION WORKER
// ============================================================================

export class EvaluationWorker {
  /**
   * Generates the standard unique idempotency key for an evaluation job.
   */
  static getJobIdempotencyKey(sessionId: string, turnSequenceNumber: number): string {
    return `eval_${sessionId}_t${turnSequenceNumber}`;
  }

  /**
   * Calculates exponential backoff delay with random jitter (Attempt 1: ~2s, 2: ~4s, 3: ~8s).
   */
  static calculateRetryDelayMs(attemptNumber: number): number {
    const baseDelay = Math.pow(2, attemptNumber) * 1000; // 2s, 4s, 8s
    const jitter = Math.floor(Math.random() * 500); // 0-500ms jitter
    return baseDelay + jitter;
  }

  /**
   * Generates a unique worker instance identifier.
   */
  static generateWorkerId(): string {
    return `worker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Atomically claims exactly ONE eligible PENDING, RETRYING, or orphaned/expired PROCESSING job.
   * Concurrency Safe: Employs 'FOR UPDATE SKIP LOCKED' in PostgreSQL or atomic conditional update.
   */
  static async claimNextJob(
    optionsOrPrisma?: ClaimJobOptions | typeof prisma
  ): Promise<EvaluationJobData | null> {
    const options: ClaimJobOptions =
      optionsOrPrisma && "$queryRawUnsafe" in (optionsOrPrisma as any)
        ? { prismaClient: optionsOrPrisma as typeof prisma }
        : (optionsOrPrisma as ClaimJobOptions) || {};

    const prismaClient = options.prismaClient || prisma;
    const workerId = options.workerId || this.generateWorkerId();
    const leaseDurationMs = options.leaseDurationMs ?? 60000;
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

    try {
      // 1. Primary PostgreSQL atomic claim with FOR UPDATE SKIP LOCKED
      // Handles:
      // a) PENDING jobs
      // b) RETRYING jobs whose backoff window has elapsed (next_retry_at <= NOW)
      // c) Orphaned PROCESSING jobs whose lease has expired (lease_expires_at <= NOW)
      const rawResult = await prismaClient.$queryRawUnsafe<any[]>(
        `
        UPDATE "evaluation_jobs"
        SET 
          "status" = 'PROCESSING'::"EvaluationJobStatus",
          "worker_id" = $1,
          "claimed_at" = NOW(),
          "lease_expires_at" = $2::timestamp,
          "updated_at" = NOW()
        WHERE "id" = (
          SELECT "id" FROM "evaluation_jobs"
          WHERE "status" = 'PENDING'::"EvaluationJobStatus"
             OR ("status" = 'RETRYING'::"EvaluationJobStatus" AND ("next_retry_at" IS NULL OR "next_retry_at" <= NOW()))
             OR ("status" = 'PROCESSING'::"EvaluationJobStatus" AND "lease_expires_at" IS NOT NULL AND "lease_expires_at" <= NOW())
          ORDER BY "created_at" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *;
      `,
        workerId,
        leaseExpiresAt.toISOString()
      );

      if (rawResult && rawResult.length > 0) {
        const row = rawResult[0];
        return {
          id: row.id,
          idempotencyKey: row.idempotency_key || row.idempotencyKey,
          sessionId: row.session_id || row.sessionId,
          turnSequenceNumber: row.turn_sequence_number || row.turnSequenceNumber,
          pillarSlug: row.pillar_slug || row.pillarSlug,
          candidateMessage: row.candidate_message || row.candidateMessage,
          contextHistory: row.context_history || row.contextHistory,
          status: row.status,
          workerId: row.worker_id || row.workerId || workerId,
          claimedAt: row.claimed_at ? new Date(row.claimed_at) : (row.claimedAt ? new Date(row.claimedAt) : now),
          leaseExpiresAt: row.lease_expires_at ? new Date(row.lease_expires_at) : (row.leaseExpiresAt ? new Date(row.leaseExpiresAt) : leaseExpiresAt),
          retryCount: row.retry_count || row.retryCount || 0,
          maxRetries: row.max_retries || row.maxRetries || 3,
          timeoutMs: row.timeout_ms || row.timeoutMs || 5000,
          nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : (row.nextRetryAt ? new Date(row.nextRetryAt) : null),
          evaluationResult: row.evaluation_result || row.evaluationResult,
          lastError: row.last_error || row.lastError,
          createdAt: new Date(row.created_at || row.createdAt),
          updatedAt: new Date(row.updated_at || row.updatedAt),
        };
      }
    } catch {
      // Fall through to Prisma atomic conditional update if raw query is unavailable or unsupported
    }

    // 2. High-reliability fallback atomic claim using Prisma optimistic conditional update
    const candidate = await prismaClient.evaluationJob.findFirst({
      where: {
        OR: [
          { status: "PENDING" },
          {
            status: "RETRYING",
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          {
            status: "PROCESSING",
            leaseExpiresAt: { lte: now },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    if (!candidate) {
      return null;
    }

    // Atomic compare-and-swap to guarantee only 1 worker claims this specific job
    const claimResult = await prismaClient.evaluationJob.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        ...(candidate.status === "PROCESSING"
          ? { leaseExpiresAt: candidate.leaseExpiresAt }
          : {}),
      },
      data: {
        status: "PROCESSING",
        workerId,
        claimedAt: now,
        leaseExpiresAt,
        updatedAt: now,
      },
    });

    if (claimResult.count === 0) {
      // Another worker claimed or processed this job concurrently
      return null;
    }

    const claimedJob = await prismaClient.evaluationJob.findUnique({
      where: { id: candidate.id },
    });

    return claimedJob as EvaluationJobData | null;
  }

  /**
   * Processes a claimed evaluation job through evaluation, validation, retry, and atomic persistence.
   */
  static async processJob(
    job: EvaluationJobData,
    options?: ProcessJobOptions
  ): Promise<{ status: EvaluationJobStatus; result: TurnEvaluationRecord | null }> {
    const prismaClient = options?.prismaClient || prisma;
    const llmProvider = options?.llmProvider || getLLMProvider();
    const timeoutMs = options?.timeoutMs || job.timeoutMs || 5000;

    // IDEMPOTENCY GUARD: A job already COMPLETED must never be evaluated again
    if (job.status === "COMPLETED" && job.evaluationResult) {
      return {
        status: "COMPLETED",
        result: job.evaluationResult as TurnEvaluationRecord,
      };
    }

    // 1. Fetch Session Context for round type & difficulty
    const session = await prismaClient.interviewSession.findUnique({
      where: { id: job.sessionId },
    });

    const roundType = session?.type || "DOMAIN";
    const currentDifficulty = session?.difficulty || "INTERMEDIATE";

    // 2. Execute Evaluator Engine with timeout cancellation
    let evalRecord: TurnEvaluationRecord;
    try {
      evalRecord = await InterviewEvaluator.evaluateTurn({
        sessionId: job.sessionId,
        turnSequenceNumber: job.turnSequenceNumber,
        candidateMessage: job.candidateMessage,
        pillarIndex: 0,
        pillarName: job.pillarSlug,
        pillarSlug: job.pillarSlug,
        roundType,
        currentDifficulty,
        llmProvider,
        timeoutMs,
      });
    } catch (err: any) {
      const errorMsg = extractLLMErrorMessage(err);
      evalRecord = {
        id: job.idempotencyKey,
        sessionId: job.sessionId,
        turnSequenceNumber: job.turnSequenceNumber,
        pillarSlug: job.pillarSlug,
        pillarName: job.pillarSlug,
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
          model: llmProvider.name,
          promptVersion: "phase-3b-v1",
          latencyMs: timeoutMs,
          timestamp: new Date().toISOString(),
        },
        errorMessage: errorMsg,
      };
    }

    // 3. CASE A: SUCCESSFUL EVALUATION -> Persist Mastery & Mark COMPLETED
    if (evalRecord.evaluationStatus === "COMPLETED" && evalRecord.overallScore !== null) {
      // Atomic Session Mastery Update
      if (session) {
        const rawMastery = (session.masteryState as any) || {
          sessionId: session.id,
          currentDifficulty: session.difficulty || "INTERMEDIATE",
          pillars: {},
          evaluations: [],
          updatedAt: new Date().toISOString(),
        };

        const currentPillarMastery: PillarMasteryState =
          rawMastery.pillars[job.pillarSlug] ||
          InterviewEvaluator.createInitialPillarMastery(job.pillarSlug, job.pillarSlug);

        // Apply EMA and streaks
        const updatedPillarMastery = InterviewEvaluator.updatePillarMastery(
          currentPillarMastery,
          evalRecord
        );

        // Compute adaptive difficulty advice
        const adaptiveDiff = InterviewEvaluator.calculateAdaptiveDifficulty(
          rawMastery.currentDifficulty,
          updatedPillarMastery.consecutiveHighScoreTurns,
          updatedPillarMastery.consecutiveLowScoreTurns
        );

        if (adaptiveDiff.action === "INCREASE" || adaptiveDiff.action === "DECREASE") {
          updatedPillarMastery.consecutiveHighScoreTurns = 0;
          updatedPillarMastery.consecutiveLowScoreTurns = 0;
        }

        rawMastery.pillars[job.pillarSlug] = updatedPillarMastery;
        rawMastery.currentDifficulty = adaptiveDiff.nextLevel;
        rawMastery.evaluations.push(evalRecord);
        rawMastery.updatedAt = new Date().toISOString();

        await prismaClient.interviewSession.update({
          where: { id: session.id },
          data: {
            masteryState: rawMastery,
            difficulty: adaptiveDiff.nextLevel,
          },
        });
      }

      // Mark Job COMPLETED and clear lease
      await prismaClient.evaluationJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          leaseExpiresAt: null,
          evaluationResult: evalRecord as any,
          lastError: null,
          updatedAt: new Date(),
        },
      });

      return { status: "COMPLETED", result: evalRecord };
    }

    // 4. CASE B: FAST-PATH NON-SUBSTANTIVE TURN (COMPLETED with score = null)
    if (evalRecord.evaluationStatus === "COMPLETED" && evalRecord.overallScore === null) {
      await prismaClient.evaluationJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          leaseExpiresAt: null,
          evaluationResult: evalRecord as any,
          lastError: null,
          updatedAt: new Date(),
        },
      });
      return { status: "COMPLETED", result: evalRecord };
    }

    // 5. CASE C: EVALUATOR FAILURE / TIMEOUT -> Retry or Transition to Terminal FAILED
    // retryCount represents completed failed attempts. Max 3 attempts means attempt 0 -> 1, 1 -> 2, 2 -> 3 (Terminal FAILED)
    const nextRetryCount = job.retryCount + 1;
    const isExhausted = nextRetryCount >= job.maxRetries;

    if (!isExhausted) {
      // Schedule Retry with Exponential Backoff + Jitter and release lease
      const delayMs = this.calculateRetryDelayMs(nextRetryCount);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await prismaClient.evaluationJob.update({
        where: { id: job.id },
        data: {
          status: "RETRYING",
          workerId: null,
          leaseExpiresAt: null,
          retryCount: nextRetryCount,
          nextRetryAt,
          lastError: evalRecord.errorMessage || "Evaluation attempt failed",
          updatedAt: new Date(),
        },
      });

      return { status: "RETRYING", result: evalRecord };
    }

    // Terminal Failure: all attempts exhausted -> Mark FAILED (NO fabricated score; mastery unchanged)
    await prismaClient.evaluationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        workerId: null,
        leaseExpiresAt: null,
        retryCount: nextRetryCount,
        nextRetryAt: null,
        evaluationResult: Prisma.DbNull,
        lastError: evalRecord.errorMessage || "Max evaluation retries exhausted",
        updatedAt: new Date(),
      },
    });

    return { status: "FAILED", result: evalRecord };
  }

  /**
   * Processes all currently eligible pending, retrying, or expired jobs in batch.
   */
  static async processAllPendingJobs(
    options?: ProcessAllOptions
  ): Promise<number> {
    const batchSize = options?.batchSize ?? 50;
    const maxDurationMs = options?.maxDurationMs ?? 25000;
    const startTime = Date.now();
    let processedCount = 0;

    while (processedCount < batchSize) {
      if (Date.now() - startTime > maxDurationMs) {
        break;
      }

      const job = await this.claimNextJob(options);
      if (!job) break;

      await this.processJob(job, options);
      processedCount++;
    }

    return processedCount;
  }
}
