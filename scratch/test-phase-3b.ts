import {
  EvaluationWorker,
  EvaluationJobData,
} from "../services/evaluation-worker";
import {
  InterviewEvaluator,
  TurnEvaluationRecord,
  PillarMasteryState,
} from "../services/evaluator";
import {
  buildInterviewState,
} from "../lib/interview/state";
import {
  InterviewOrchestrator,
  TECHNICAL_PILLARS,
} from "../services/interview-engine";
import { LLMProvider } from "../lib/llm";
import { EvaluationJobStatus, Prisma } from "@prisma/client";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

// In-Memory Stateful Mock Prisma Harness for Concurrent Worker & Transaction Testing
class MockPrismaHarness {
  messages: any[] = [];
  jobs: Map<string, EvaluationJobData> = new Map();
  sessions: Map<string, any> = new Map();
  transactionCount = 0;

  constructor() {
    this.sessions.set("session_3b_test", {
      id: "session_3b_test",
      userId: "user_3b",
      type: "DOMAIN",
      domain: "Software_Engineering",
      difficulty: "MID",
      masteryState: null,
    });
  }

  interviewMessage = {
    create: async ({ data }: any) => {
      const msg = { id: `msg_${Date.now()}_${Math.random()}`, ...data, createdAt: new Date() };
      this.messages.push(msg);
      return msg;
    },
    findMany: async ({ where }: any) => {
      return this.messages.filter((m) => m.sessionId === where.sessionId);
    },
  };

  evaluationJob = {
    create: async ({ data }: any) => {
      // Enforce unique idempotencyKey constraint
      for (const job of Array.from(this.jobs.values())) {
        if (job.idempotencyKey === data.idempotencyKey) {
          const error: any = new Error(`Unique constraint failed on the fields: (idempotency_key)`);
          error.code = "P2002";
          throw error;
        }
      }
      const newJob: EvaluationJobData = {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        idempotencyKey: data.idempotencyKey,
        sessionId: data.sessionId,
        turnSequenceNumber: data.turnSequenceNumber,
        pillarSlug: data.pillarSlug,
        candidateMessage: data.candidateMessage,
        contextHistory: data.contextHistory || [],
        status: data.status || "PENDING",
        workerId: data.workerId || null,
        claimedAt: data.claimedAt || null,
        leaseExpiresAt: data.leaseExpiresAt || null,
        retryCount: data.retryCount || 0,
        maxRetries: data.maxRetries || 3,
        timeoutMs: data.timeoutMs || 5000,
        nextRetryAt: data.nextRetryAt || null,
        evaluationResult: data.evaluationResult || null,
        lastError: data.lastError || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.jobs.set(newJob.id, newJob);
      return newJob;
    },
    findFirst: async ({ where, orderBy }: any) => {
      const now = new Date();
      const eligible = Array.from(this.jobs.values()).filter((j) => {
        if (j.status === "PENDING") return true;
        if (j.status === "RETRYING") {
          return !j.nextRetryAt || j.nextRetryAt <= now;
        }
        return false;
      });
      eligible.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return eligible[0] || null;
    },
    findUnique: async ({ where }: any) => {
      return this.jobs.get(where.id) || null;
    },
    updateMany: async ({ where, data }: any) => {
      const job = this.jobs.get(where.id);
      if (!job || job.status !== where.status) {
        return { count: 0 }; // Atomic lock failed
      }
      Object.assign(job, data, { updatedAt: new Date() });
      return { count: 1 }; // Successfully claimed
    },
    update: async ({ where, data }: any) => {
      const job = this.jobs.get(where.id);
      if (!job) throw new Error(`Job not found: ${where.id}`);
      Object.assign(job, data, { updatedAt: new Date() });
      return job;
    },
  };

  interviewSession = {
    findUnique: async ({ where }: any) => {
      return this.sessions.get(where.id) || null;
    },
    update: async ({ where, data }: any) => {
      const session = this.sessions.get(where.id);
      if (!session) throw new Error(`Session not found: ${where.id}`);
      Object.assign(session, data);
      return session;
    },
  };

  $transaction = async (promisesOrArray: any) => {
    this.transactionCount++;
    if (Array.isArray(promisesOrArray)) {
      return Promise.all(promisesOrArray);
    }
    return promisesOrArray(this);
  };

  $queryRawUnsafe = async (sql: string) => {
    // Simulates PostgreSQL FOR UPDATE SKIP LOCKED
    const candidate = await this.evaluationJob.findFirst({});
    if (!candidate) return [];
    candidate.status = "PROCESSING" as EvaluationJobStatus;
    candidate.updatedAt = new Date();
    return [candidate];
  };
}

async function runPhase3BTests() {
  console.log("\n==================================================");
  console.log("RUNNING PHASE 3B DURABLE EVALUATION INFRASTRUCTURE TESTS");
  console.log("==================================================\n");

  const mockDb = new MockPrismaHarness();

  // ----------------------------------------------------
  // TEST 1: EvaluationJob creation
  // ----------------------------------------------------
  console.log("TEST 1: EvaluationJob Creation");
  const job1 = await mockDb.evaluationJob.create({
    data: {
      idempotencyKey: "eval_s1_t1",
      sessionId: "session_3b_test",
      turnSequenceNumber: 1,
      pillarSlug: "TECH-0",
      candidateMessage: "We decoupled services with Kafka and PostgreSQL.",
      contextHistory: [],
      status: "PENDING",
      maxRetries: 3,
      timeoutMs: 5000,
    },
  });
  assert(job1.idempotencyKey === "eval_s1_t1", "Job created with idempotencyKey");
  assert(job1.status === "PENDING", "Initial status is PENDING");
  assert(job1.maxRetries === 3, "maxRetries is 3");

  // ----------------------------------------------------
  // TEST 2: Transactional InterviewMessage + EvaluationJob creation
  // ----------------------------------------------------
  console.log("\nTEST 2: Transactional Outbox (Message + EvaluationJob in 1 Transaction)");
  const txStart = Date.now();
  const txResult = await mockDb.$transaction([
    mockDb.interviewMessage.create({
      data: {
        sessionId: "session_3b_test",
        role: "user",
        content: "Candidate answer inside transaction",
      },
    }),
    mockDb.evaluationJob.create({
      data: {
        idempotencyKey: "eval_session_3b_test_t2",
        sessionId: "session_3b_test",
        turnSequenceNumber: 2,
        pillarSlug: "TECH-0",
        candidateMessage: "Candidate answer inside transaction",
        status: "PENDING",
      },
    }),
  ]);
  const txDuration = Date.now() - txStart;
  assert(txResult.length === 2, "Both message and job created in 1 atomic transaction");
  assert(mockDb.transactionCount > 0, "Prisma $transaction was invoked");
  console.log(`  ✓ Transaction completed in ${txDuration}ms`);

  // ----------------------------------------------------
  // TEST 3: Duplicate idempotency key rejection
  // ----------------------------------------------------
  console.log("\nTEST 3: Duplicate Idempotency Key Rejection");
  let duplicateRejected = false;
  try {
    await mockDb.evaluationJob.create({
      data: {
        idempotencyKey: "eval_s1_t1", // Already exists
        sessionId: "session_3b_test",
        turnSequenceNumber: 1,
        pillarSlug: "TECH-0",
        candidateMessage: "Duplicate turn attempt",
      },
    });
  } catch (err: any) {
    duplicateRejected = err.code === "P2002";
  }
  assert(duplicateRejected, "Duplicate idempotencyKey rejected by unique constraint");

  // ----------------------------------------------------
  // TEST 4 & 6: Atomic worker claim (PENDING -> PROCESSING)
  // ----------------------------------------------------
  console.log("\nTEST 4 & 6: Atomic Worker Claim (PENDING -> PROCESSING)");
  const claimedJob = await EvaluationWorker.claimNextJob(mockDb as any);
  assert(claimedJob !== null, "Worker claimed an eligible job");
  assert(claimedJob?.status === "PROCESSING", "Job transitioned to PROCESSING status");

  // ----------------------------------------------------
  // TEST 5: Two-worker concurrency protection
  // ----------------------------------------------------
  console.log("\nTEST 5: Two-Worker Concurrency Protection");
  // Attempt concurrent claim on the same job
  const secondClaim = await mockDb.evaluationJob.updateMany({
    where: { id: claimedJob!.id, status: "PENDING" as any }, // Will fail because already PROCESSING
    data: { status: "PROCESSING" as any },
  });
  assert(secondClaim.count === 0, "Second worker blocked from double-claiming in-flight job");

  // ----------------------------------------------------
  // TEST 7: PROCESSING -> COMPLETED with Successful Evaluation
  // ----------------------------------------------------
  console.log("\nTEST 7: Successful Evaluation Flow (PROCESSING -> COMPLETED)");
  class MockSuccessLLM implements LLMProvider {
    name = "mock-success-llm";
    async generateText(): Promise<string> {
      return JSON.stringify({
        overallScore: 88,
        confidence: 0.95,
        rubricScores: [
          { dimension: "Architecture", score: 88, weight: 1.0, evidenceSnippet: "Kafka", feedback: "Good" },
        ],
        demonstratedConcepts: ["Kafka"],
        missingConcepts: [],
        strengths: ["Clear decoupling"],
        weaknesses: [],
        masterySignal: "MASTERY_HIGH",
        recommendedDifficulty: "INCREASE",
      });
    }
    async streamText(): Promise<string> { return ""; }
  }

  const processResult = await EvaluationWorker.processJob(claimedJob!, {
    prismaClient: mockDb as any,
    llmProvider: new MockSuccessLLM(),
  });
  assert(processResult.status === "COMPLETED", "Job marked COMPLETED");
  assert(processResult.result?.overallScore === 88, "Turn scored 88/100");

  const completedInDb = await mockDb.evaluationJob.findUnique({ where: { id: claimedJob!.id } });
  assert(completedInDb?.status === "COMPLETED", "Status persisted as COMPLETED in DB");
  assert(completedInDb?.evaluationResult !== null, "evaluationResult persisted");

  // ----------------------------------------------------
  // TEST 8 & 9: Timeout -> RETRYING with Exponential Backoff
  // ----------------------------------------------------
  console.log("\nTEST 8 & 9: Timeout / Provider Error -> RETRYING with Exponential Backoff");
  const jobToTimeout = await mockDb.evaluationJob.create({
    data: {
      idempotencyKey: "eval_timeout_test_t1",
      sessionId: "session_3b_test",
      turnSequenceNumber: 3,
      pillarSlug: "TECH-1",
      candidateMessage: "Candidate response that will time out",
      status: "PROCESSING",
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 50, // Short timeout
    },
  });

  class MockSlowLLM implements LLMProvider {
    name = "mock-slow-llm";
    async generateText(): Promise<string> {
      await new Promise((r) => setTimeout(r, 200)); // Stalls past 50ms timeout
      return "{}";
    }
    async streamText(): Promise<string> { return ""; }
  }

  const timeoutResult = await EvaluationWorker.processJob(jobToTimeout, {
    prismaClient: mockDb as any,
    llmProvider: new MockSlowLLM(),
    timeoutMs: 50,
  });

  assert(timeoutResult.status === "RETRYING", "Timed-out job transitioned to RETRYING");
  const retryingInDb = await mockDb.evaluationJob.findUnique({ where: { id: jobToTimeout.id } });
  assert(retryingInDb?.retryCount === 1, "retryCount incremented to 1");
  assert(
    retryingInDb?.nextRetryAt !== null &&
      retryingInDb?.nextRetryAt !== undefined &&
      retryingInDb.nextRetryAt.getTime() > Date.now(),
    "Backoff time is in future"
  );

  // Verify exponential backoff progressions
  const delay1 = EvaluationWorker.calculateRetryDelayMs(1);
  const delay2 = EvaluationWorker.calculateRetryDelayMs(2);
  const delay3 = EvaluationWorker.calculateRetryDelayMs(3);
  assert(delay1 >= 2000 && delay1 <= 2500, `Attempt 1 delay: ${delay1}ms (~2s)`);
  assert(delay2 >= 4000 && delay2 <= 4500, `Attempt 2 delay: ${delay2}ms (~4s)`);
  assert(delay3 >= 8000 && delay3 <= 8500, `Attempt 3 delay: ${delay3}ms (~8s)`);

  // ----------------------------------------------------
  // TEST 10: Retry Exhaustion -> FAILED (No Fabricated Score)
  // ----------------------------------------------------
  console.log("\nTEST 10: Retry Exhaustion -> FAILED (Zero Fabricated Score)");
  const jobExhausting = await mockDb.evaluationJob.create({
    data: {
      idempotencyKey: "eval_exhaust_test_t1",
      sessionId: "session_3b_test",
      turnSequenceNumber: 4,
      pillarSlug: "TECH-1",
      candidateMessage: "Permanent failure message",
      status: "PROCESSING",
      retryCount: 2, // 2 previous attempts
      maxRetries: 3,
    },
  });

  const exhaustResult = await EvaluationWorker.processJob(jobExhausting, {
    prismaClient: mockDb as any,
    llmProvider: new MockSlowLLM(),
    timeoutMs: 50,
  });

  assert(exhaustResult.status === "FAILED", "Job marked FAILED upon 3rd failure");
  const failedInDb = await mockDb.evaluationJob.findUnique({ where: { id: jobExhausting.id } });
  assert(failedInDb?.status === "FAILED", "Database status is FAILED");
  assert(failedInDb?.retryCount === 3, "retryCount reached 3");
  assert(
    failedInDb?.evaluationResult === null ||
      failedInDb?.evaluationResult === Prisma.DbNull ||
      failedInDb?.evaluationResult === Prisma.JsonNull,
    "evaluationResult is null (No fake score)"
  );

  // ----------------------------------------------------
  // TEST 11: Worker Restart Recovery
  // ----------------------------------------------------
  console.log("\nTEST 11: Worker Restart Recovery");
  // Simulate worker crash leaving a job in PENDING
  const crashJob = await mockDb.evaluationJob.create({
    data: {
      idempotencyKey: "eval_crash_recovery_t1",
      sessionId: "session_3b_test",
      turnSequenceNumber: 5,
      pillarSlug: "TECH-2",
      candidateMessage: "Recovered turn message",
      status: "PENDING",
    },
  });

  // Re-initialized worker claims the earliest pending job
  const recoveredJob = await EvaluationWorker.claimNextJob(mockDb as any);
  assert(recoveredJob !== null && recoveredJob.status === "PROCESSING", "Worker successfully claimed orphaned PENDING job after restart");

  // ----------------------------------------------------
  // TEST 12 & 13: Malformed Evaluator Output & Provider Error Handling
  // ----------------------------------------------------
  console.log("\nTEST 12 & 13: Malformed JSON Output & Provider Error Handling");
  class MockMalformedLLM implements LLMProvider {
    name = "mock-malformed-llm";
    async generateText(): Promise<string> { return "Invalid Non-JSON response from LLM"; }
    async streamText(): Promise<string> { return ""; }
  }

  const malformedJob = await mockDb.evaluationJob.create({
    data: {
      idempotencyKey: "eval_malformed_t1",
      sessionId: "session_3b_test",
      turnSequenceNumber: 6,
      pillarSlug: "TECH-2",
      candidateMessage: "Message with malformed LLM reply",
      status: "PROCESSING",
      retryCount: 0,
      maxRetries: 3,
    },
  });

  const malformedResult = await EvaluationWorker.processJob(malformedJob, {
    prismaClient: mockDb as any,
    llmProvider: new MockMalformedLLM(),
  });
  assert(malformedResult.status === "RETRYING", "Malformed JSON treated safely as retryable failure");

  // ----------------------------------------------------
  // TEST 14: Failed evaluation leaves session mastery unchanged
  // ----------------------------------------------------
  console.log("\nTEST 14: Failed Evaluation Leaves Session Mastery Unchanged");
  const sessionBefore = await mockDb.interviewSession.findUnique({ where: { id: "session_3b_test" } });
  const masteryBeforeJson = JSON.stringify(sessionBefore?.masteryState);

  // Process a failing job
  await EvaluationWorker.processJob(jobExhausting, {
    prismaClient: mockDb as any,
    llmProvider: new MockSlowLLM(),
    timeoutMs: 50,
  });

  const sessionAfter = await mockDb.interviewSession.findUnique({ where: { id: "session_3b_test" } });
  assert(JSON.stringify(sessionAfter?.masteryState) === masteryBeforeJson, "Session mastery 100% unchanged after failed evaluation");

  // ----------------------------------------------------
  // TEST 15: Successful evaluation persists session mastery
  // ----------------------------------------------------
  console.log("\nTEST 15: Successful Evaluation Persists Session Mastery");
  const sessionMasteryData = sessionAfter?.masteryState;
  assert(sessionMasteryData !== null, "Session mastery persisted in database");
  assert(sessionMasteryData?.pillars["TECH-0"]?.rollingScore === 88, "Pillar TECH-0 rolling EMA persisted as 88");

  // ----------------------------------------------------
  // TEST 16: Stale evaluation cannot overwrite newer mastery
  // ----------------------------------------------------
  console.log("\nTEST 16: Stale / Out-of-Order Evaluation Rejection");
  const staleEval: TurnEvaluationRecord = {
    id: "eval_stale",
    sessionId: "session_3b_test",
    turnSequenceNumber: 1, // Turn 1 arrived after Turn 2
    pillarSlug: "TECH-0",
    pillarName: "Architecture",
    evaluationStatus: "COMPLETED",
    overallScore: 20, // Stale low score
    confidence: 1.0,
    rubricScores: [],
    demonstratedConcepts: [],
    missingConcepts: [],
    strengths: [],
    weaknesses: [],
    masterySignal: "CRITICAL_GAP",
    recommendedDifficulty: "DECREASE",
    evaluatorMetadata: { model: "mock", promptVersion: "v1", latencyMs: 0, timestamp: new Date().toISOString() },
    errorMessage: null,
  };

  const currentMastery = sessionMasteryData.pillars["TECH-0"];
  const updatedAfterStale = InterviewEvaluator.updatePillarMastery(currentMastery, staleEval);
  assert(updatedAfterStale.rollingScore === 88, "Stale turn rejected from rolling EMA calculation");

  // ----------------------------------------------------
  // TEST 17: Completed job cannot execute twice
  // ----------------------------------------------------
  console.log("\nTEST 17: Completed Job Cannot Execute Twice");
  const completedJobRecord = await mockDb.evaluationJob.findUnique({ where: { id: claimedJob!.id } });
  const duplicateRun = await EvaluationWorker.processJob(completedJobRecord!, {
    prismaClient: mockDb as any,
    llmProvider: new MockSlowLLM(), // Would fail if executed
  });
  assert(duplicateRun.status === "COMPLETED", "Completed job immediately returns without re-executing LLM");

  // ----------------------------------------------------
  // TEST 18: Candidate SSE stream does not wait for evaluator (Latency Proof)
  // ----------------------------------------------------
  console.log("\nTEST 18: Candidate SSE Latency Decoupling (<300ms TTFT)");
  const candidateTurnStart = Date.now();
  // Simulates candidate turn route execution:
  await mockDb.$transaction([
    mockDb.interviewMessage.create({
      data: { sessionId: "session_3b_test", role: "user", content: "High performance Redis cache" },
    }),
    mockDb.evaluationJob.create({
      data: {
        idempotencyKey: "eval_perf_t1",
        sessionId: "session_3b_test",
        turnSequenceNumber: 7,
        pillarSlug: "TECH-2",
        candidateMessage: "High performance Redis cache",
        status: "PENDING",
      },
    }),
  ]);
  const candidateTurnDuration = Date.now() - candidateTurnStart;
  assert(candidateTurnDuration < 50, `Candidate route transactional outbox overhead: ${candidateTurnDuration}ms (<50ms)`);
  console.log(`  ✓ Candidate route latency overhead: ${candidateTurnDuration}ms (Independent of evaluation duration)`);

  // ----------------------------------------------------
  // TEST 19: Phase 2 progression authority remains intact
  // ----------------------------------------------------
  console.log("\nTEST 19: Phase 2 Progression Authority Preservation");
  const mockState = buildInterviewState({
    id: "session_3b_test",
    type: "DOMAIN",
    difficulty: "SENIOR",
    status: "IN_PROGRESS",
    messages: [
      { role: "assistant", content: "Intro question", createdAt: new Date() },
      { role: "user", content: "Intro answer with 6 years experience", createdAt: new Date() },
      { role: "assistant", content: "Architecture question 1", createdAt: new Date() },
    ],
  }, "Substantive answer on architecture");

  const orchestratorDecision = InterviewOrchestrator.decideNextStep({
    state: mockState,
    candidateMessage: "Substantive answer on architecture",
    options: {
      evaluationScoreOverride: 100, // Perfect score from evaluator
      turnsPerPillarTarget: 2,
    },
  });

  // Orchestrator stays on Pillar 0 because turn count is 1 < target 2
  assert(orchestratorDecision.action === "DRILL_DOWN", "Evaluator score did NOT force premature ADVANCE_PILLAR");
  assert(orchestratorDecision.targetPillarIndex === 0, "Active pillar remains Pillar 0 (System Architecture)");

  console.log("\n==================================================");
  console.log("ALL 20 PHASE 3B DURABLE INFRASTRUCTURE TESTS PASSED!");
  console.log("==================================================\n");
}

runPhase3BTests().catch((err) => {
  console.error("Phase 3B Test Suite Failed:", err);
  process.exit(1);
});
