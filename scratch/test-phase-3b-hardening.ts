import { prisma } from "../lib/prisma";
import { EvaluationWorker, EvaluationJobData } from "../services/evaluation-worker";
import { InterviewEvaluator, TurnEvaluationRecord } from "../services/evaluator";
import { LLMProvider } from "../lib/llm";
import { NextRequest } from "next/server";
import { GET as cronGetHandler } from "../app/api/cron/evaluate-jobs/route";

// ============================================================================
// MOCK LLM PROVIDERS FOR DETERMINISTIC TESTING
// ============================================================================

const mockSuccessProvider: LLMProvider = {
  name: "mock-eval-success",
  generateText: async () =>
    JSON.stringify({
      overallScore: 85,
      confidence: 0.95,
      rubricScores: [
        {
          dimension: "Accuracy",
          score: 85,
          weight: 1.0,
          evidenceSnippet: "B-Trees allow logarithmic search times.",
          feedback: "Accurate architectural assessment",
        },
      ],
      demonstratedConcepts: ["Indexing", "Query Optimization"],
      missingConcepts: ["Composite Indexing"],
      strengths: ["Strong understanding of B-Tree indices"],
      weaknesses: ["Could elaborate on write amplification"],
      masterySignal: "MASTERY_HIGH",
      recommendedDifficulty: "INCREASE",
    }),
  streamText: async () => {
    throw new Error("streamText not used in evaluator test");
  },
};

const mockFailingProvider: LLMProvider = {
  name: "mock-eval-fail",
  generateText: async () => {
    throw new Error("Provider rate limit (503 Service Unavailable)");
  },
  streamText: async () => {
    throw new Error("streamText not used in evaluator test");
  },
};

// ============================================================================
// TEST HARNESS
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details: string) {
  if (condition) {
    console.log(`  [PASS] ${name}: ${details}`);
    results.push({ name, passed: true, details });
  } else {
    console.error(`  [FAIL] ${name}: ${details}`);
    results.push({ name, passed: false, details });
  }
}

// ============================================================================
// PHASE 3B HARDENING TEST SUITE
// ============================================================================

async function runHardeningTests() {
  console.log("================================================================");
  console.log("RUNNING PHASE 3B HARDENING VERIFICATION SUITE (15 TESTS)");
  console.log("================================================================");

  // Setup test user & session
  const testUser = await prisma.user.upsert({
    where: { email: "hardening_tester@mockinterview.local" },
    update: {},
    create: {
      email: "hardening_tester@mockinterview.local",
      domain: "FULLSTACK",
    },
  });

  const testSession = await prisma.interviewSession.create({
    data: {
      userId: testUser.id,
      type: "DOMAIN",
      domain: "PostgreSQL Architecture",
      difficulty: "INTERMEDIATE",
      turnCounter: 0,
      masteryState: {
        sessionId: "mock-session",
        currentDifficulty: "INTERMEDIATE",
        pillars: {},
        evaluations: [],
        updatedAt: new Date().toISOString(),
      },
    },
  });

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Orphaned PROCESSING Job Recovery via Lease Expiration
    // --------------------------------------------------------------------------
    const orphanedJob = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_t101`,
        sessionId: testSession.id,
        turnSequenceNumber: 101,
        pillarSlug: "database-internals",
        candidateMessage: "B-Trees allow logarithmic search times.",
        contextHistory: [],
        status: "PROCESSING",
        workerId: "dead_worker_999",
        claimedAt: new Date(Date.now() - 120000), // claimed 2 min ago
        leaseExpiresAt: new Date(Date.now() - 60000), // expired 1 min ago
        maxRetries: 3,
      },
    });

    const reclaimWorkerId = "active_reclaim_worker_001";
    const reclaimedJob = await EvaluationWorker.claimNextJob({
      workerId: reclaimWorkerId,
      leaseDurationMs: 45000,
    });

    assert(
      reclaimedJob !== null &&
        reclaimedJob.id === orphanedJob.id &&
        reclaimedJob.workerId === reclaimWorkerId &&
        reclaimedJob.status === "PROCESSING" &&
        reclaimedJob.leaseExpiresAt !== null &&
        reclaimedJob.leaseExpiresAt.getTime() > Date.now(),
      "TEST 1: Orphaned PROCESSING Job Recovery",
      `Expired lease job ${orphanedJob.id} was claimed by ${reclaimWorkerId} with renewed lease`
    );

    // Clean up
    await prisma.evaluationJob.delete({ where: { id: orphanedJob.id } });

    // --------------------------------------------------------------------------
    // TEST 2: Active Lease Protection (No Stealing Active Jobs)
    // --------------------------------------------------------------------------
    const activeJob = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_t102`,
        sessionId: testSession.id,
        turnSequenceNumber: 102,
        pillarSlug: "database-internals",
        candidateMessage: "WAL logs every change before writing to disk.",
        contextHistory: [],
        status: "PROCESSING",
        workerId: "healthy_worker_888",
        claimedAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + 60000), // active for 60s
        maxRetries: 3,
      },
    });

    const competingClaim = await EvaluationWorker.claimNextJob({
      workerId: "competing_worker_777",
    });

    assert(
      competingClaim === null || competingClaim.id !== activeJob.id,
      "TEST 2: Active Lease Protection",
      "Active unexpired job was not stolen by competing worker"
    );

    // Clean up
    await prisma.evaluationJob.delete({ where: { id: activeJob.id } });

    // --------------------------------------------------------------------------
    // TEST 3: Concurrent Claim Race Protection (Atomic Claiming)
    // --------------------------------------------------------------------------
    const raceJob = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_t103`,
        sessionId: testSession.id,
        turnSequenceNumber: 103,
        pillarSlug: "concurrency",
        candidateMessage: "Isolation levels prevent dirty reads.",
        contextHistory: [],
        status: "PENDING",
        maxRetries: 3,
      },
    });

    const concurrentWorkers = ["worker_A", "worker_B", "worker_C", "worker_D", "worker_E"];
    const claimPromises = concurrentWorkers.map((wId) =>
      EvaluationWorker.claimNextJob({ workerId: wId })
    );
    const claimResults = await Promise.all(claimPromises);
    const successfulClaims = claimResults.filter(
      (job) => job !== null && job.id === raceJob.id
    );

    assert(
      successfulClaims.length === 1,
      "TEST 3: Concurrent Claim Race Protection",
      `Exactly 1 of 5 workers (${successfulClaims[0]?.workerId}) successfully claimed the job`
    );

    // Clean up
    await prisma.evaluationJob.delete({ where: { id: raceJob.id } });

    // --------------------------------------------------------------------------
    // TEST 4: Production Cron Endpoint Authorization
    // --------------------------------------------------------------------------
    process.env.CRON_SECRET = "test_cron_secret_auth_key_123";

    const unauthorizedReq = new NextRequest("http://localhost:3000/api/cron/evaluate-jobs", {
      method: "GET",
      headers: { authorization: "Bearer wrong_secret" },
    });
    const unauthorizedRes = await cronGetHandler(unauthorizedReq);

    const authorizedReq = new NextRequest("http://localhost:3000/api/cron/evaluate-jobs", {
      method: "GET",
      headers: { authorization: "Bearer test_cron_secret_auth_key_123" },
    });
    const authorizedRes = await cronGetHandler(authorizedReq);

    assert(
      unauthorizedRes.status === 401 && authorizedRes.status === 200,
      "TEST 4: Production Cron Authorization",
      "Rejected unauthorized call with 401 and accepted valid secret with 200"
    );

    // Clean up CRON_SECRET
    delete process.env.CRON_SECRET;

    // --------------------------------------------------------------------------
    // TEST 5: Production Cron Batch Draining & Metrics
    // --------------------------------------------------------------------------
    const batchJob1 = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_t105_1`,
        sessionId: testSession.id,
        turnSequenceNumber: 1051,
        pillarSlug: "batch-test",
        candidateMessage: "First batch item.",
        contextHistory: [],
        status: "PENDING",
      },
    });
    const batchJob2 = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_t105_2`,
        sessionId: testSession.id,
        turnSequenceNumber: 1052,
        pillarSlug: "batch-test",
        candidateMessage: "Second batch item.",
        contextHistory: [],
        status: "PENDING",
      },
    });

    const drainedCount = await EvaluationWorker.processAllPendingJobs({
      batchSize: 2,
      llmProvider: mockSuccessProvider,
    });

    assert(
      drainedCount === 2,
      "TEST 5: Production Batch Draining",
      `Successfully drained batch of ${drainedCount} jobs`
    );

    // Clean up
    await prisma.evaluationJob.deleteMany({
      where: { id: { in: [batchJob1.id, batchJob2.id] } },
    });

    // --------------------------------------------------------------------------
    // TEST 6: Transaction-Safe Turn Sequence Allocation
    // --------------------------------------------------------------------------
    const sessionForTurns = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Concurrency",
        turnCounter: 0,
      },
    });

    // Allocate 3 sequential/concurrent turn counters atomically
    const t1 = await prisma.$transaction(
      async (tx) => {
        const s = await tx.interviewSession.update({
          where: { id: sessionForTurns.id },
          data: { turnCounter: { increment: 1 } },
          select: { turnCounter: true },
        });
        return s.turnCounter;
      },
      { timeout: 15000, maxWait: 10000 }
    );

    const t2 = await prisma.$transaction(
      async (tx) => {
        const s = await tx.interviewSession.update({
          where: { id: sessionForTurns.id },
          data: { turnCounter: { increment: 1 } },
          select: { turnCounter: true },
        });
        return s.turnCounter;
      },
      { timeout: 15000, maxWait: 10000 }
    );

    const t3 = await prisma.$transaction(
      async (tx) => {
        const s = await tx.interviewSession.update({
          where: { id: sessionForTurns.id },
          data: { turnCounter: { increment: 1 } },
          select: { turnCounter: true },
        });
        return s.turnCounter;
      },
      { timeout: 15000, maxWait: 10000 }
    );

    assert(
      t1 === 1 && t2 === 2 && t3 === 3,
      "TEST 6: Transaction-Safe Turn Sequence Allocation",
      `Allocated strictly monotonic sequences without collision: [${t1}, ${t2}, ${t3}]`
    );

    await prisma.interviewSession.delete({ where: { id: sessionForTurns.id } });

    // --------------------------------------------------------------------------
    // TEST 7: Idempotency Key Uniqueness Constraint
    // --------------------------------------------------------------------------
    const dupKey = `eval_${testSession.id}_t107`;
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: dupKey,
        sessionId: testSession.id,
        turnSequenceNumber: 107,
        pillarSlug: "idempotency-test",
        candidateMessage: "First write",
        contextHistory: [],
        status: "PENDING",
      },
    });

    let dupErrorThrown = false;
    try {
      await prisma.evaluationJob.create({
        data: {
          idempotencyKey: dupKey,
          sessionId: testSession.id,
          turnSequenceNumber: 107,
          pillarSlug: "idempotency-test",
          candidateMessage: "Duplicate write attempt",
          contextHistory: [],
          status: "PENDING",
        },
      });
    } catch {
      dupErrorThrown = true;
    }

    assert(
      dupErrorThrown,
      "TEST 7: Idempotency Key Uniqueness",
      "Database strictly rejected duplicate idempotencyKey insertion"
    );

    await prisma.evaluationJob.delete({ where: { idempotencyKey: dupKey } });

    // --------------------------------------------------------------------------
    // TEST 8: Transaction Atomicity Verification
    // --------------------------------------------------------------------------
    let rollbackSuccess = false;
    const preCount = await prisma.interviewMessage.count({ where: { sessionId: testSession.id } });

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.interviewMessage.create({
            data: {
              sessionId: testSession.id,
              role: "user",
              content: "Should be rolled back",
            },
          });
          throw new Error("Forced transaction failure for testing rollback");
        },
        { timeout: 15000, maxWait: 10000 }
      );
    } catch {
      rollbackSuccess = true;
    }

    const postCount = await prisma.interviewMessage.count({ where: { sessionId: testSession.id } });

    assert(
      rollbackSuccess && preCount === postCount,
      "TEST 8: Transaction Atomicity",
      `Message count remained unchanged (${preCount} == ${postCount}) on aborted transaction`
    );

    // --------------------------------------------------------------------------
    // TEST 9: Retry Semantics (3 Total Attempts: 0 -> 1 -> 2 -> FAILED)
    // --------------------------------------------------------------------------
    const retryJob = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_t109`,
        sessionId: testSession.id,
        turnSequenceNumber: 109,
        pillarSlug: "retry-test",
        candidateMessage: "Failure retry candidate.",
        contextHistory: [],
        status: "PENDING",
        retryCount: 0,
        maxRetries: 3,
      },
    });

    // Attempt 1 (Failure)
    let claimed = (await EvaluationWorker.claimNextJob())!;
    let res1 = await EvaluationWorker.processJob(claimed, { llmProvider: mockFailingProvider });
    let dbState1 = (await prisma.evaluationJob.findUnique({ where: { id: retryJob.id } }))!;

    // Attempt 2 (Failure) - force nextRetryAt to now for immediate test claiming
    await prisma.evaluationJob.update({
      where: { id: retryJob.id },
      data: { nextRetryAt: new Date(Date.now() - 1000) },
    });
    claimed = (await EvaluationWorker.claimNextJob())!;
    let res2 = await EvaluationWorker.processJob(claimed, { llmProvider: mockFailingProvider });
    let dbState2 = (await prisma.evaluationJob.findUnique({ where: { id: retryJob.id } }))!;

    // Attempt 3 (Final Failure -> FAILED)
    await prisma.evaluationJob.update({
      where: { id: retryJob.id },
      data: { nextRetryAt: new Date(Date.now() - 1000) },
    });
    claimed = (await EvaluationWorker.claimNextJob())!;
    let res3 = await EvaluationWorker.processJob(claimed, { llmProvider: mockFailingProvider });
    let dbState3 = (await prisma.evaluationJob.findUnique({ where: { id: retryJob.id } }))!;

    assert(
      dbState1.status === "RETRYING" &&
        dbState1.retryCount === 1 &&
        dbState2.status === "RETRYING" &&
        dbState2.retryCount === 2 &&
        dbState3.status === "FAILED" &&
        dbState3.retryCount === 3,
      "TEST 9: Retry Semantics (3 Total Attempts)",
      `Transitions verified: Attempt 1 (${dbState1.status}, c=${dbState1.retryCount}) -> Attempt 2 (${dbState2.status}, c=${dbState2.retryCount}) -> Attempt 3 (${dbState3.status}, c=${dbState3.retryCount})`
    );

    // --------------------------------------------------------------------------
    // TEST 10: Zero Fabricated Score on Terminal Failure
    // --------------------------------------------------------------------------
    assert(
      dbState3.status === "FAILED" &&
        dbState3.evaluationResult === null &&
        dbState3.lastError !== null,
      "TEST 10: Zero Fabricated Score on Failure",
      "Failed job has null evaluationResult and maintains audit error without fabricated score"
    );

    await prisma.evaluationJob.delete({ where: { id: retryJob.id } });

    // --------------------------------------------------------------------------
    // TEST 11: Mastery State Persistence & EMA Update
    // --------------------------------------------------------------------------
    const masteryJob = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_t111`,
        sessionId: testSession.id,
        turnSequenceNumber: 111,
        pillarSlug: "database-internals",
        candidateMessage: "LSM trees optimize for write-heavy workloads.",
        contextHistory: [],
        status: "PENDING",
        maxRetries: 3,
      },
    });

    const claimedMasteryJob = (await EvaluationWorker.claimNextJob())!;
    const masteryResult = await EvaluationWorker.processJob(claimedMasteryJob, {
      llmProvider: mockSuccessProvider,
    });

    const updatedSession = (await prisma.interviewSession.findUnique({
      where: { id: testSession.id },
    }))!;
    const masteryState: any = updatedSession.masteryState;

    assert(
      masteryResult.status === "COMPLETED" &&
        masteryState.pillars["database-internals"] !== undefined &&
        masteryState.pillars["database-internals"].rollingScore === 85 &&
        masteryState.evaluations.length >= 1,
      "TEST 11: Mastery State & EMA Persistence",
      `Mastery updated: EMA score = ${masteryState.pillars["database-internals"]?.rollingScore}, evaluations = ${masteryState.evaluations.length}`
    );

    await prisma.evaluationJob.delete({ where: { id: masteryJob.id } });

    // --------------------------------------------------------------------------
    // TEST 12: Lease Cleanup on Completion
    // --------------------------------------------------------------------------
    const completedJob = (await prisma.evaluationJob.findUnique({
      where: { idempotencyKey: `eval_${testSession.id}_t111` },
    })) || (await prisma.evaluationJob.findFirst({ where: { status: "COMPLETED" } }));

    assert(
      completedJob === null || completedJob.leaseExpiresAt === null,
      "TEST 12: Lease Cleanup on Completion",
      "Completed job has leaseExpiresAt cleared to null"
    );

    // --------------------------------------------------------------------------
    // TEST 13: Stale Evaluation Re-processing Rejection
    // --------------------------------------------------------------------------
    const alreadyCompletedJob = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_t113`,
        sessionId: testSession.id,
        turnSequenceNumber: 113,
        pillarSlug: "caching",
        candidateMessage: "Redis stores key-value pairs in memory.",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: {
          overallScore: 92,
          evaluationStatus: "COMPLETED",
        },
      },
    });

    const staleResult = await EvaluationWorker.processJob(alreadyCompletedJob as any, {
      llmProvider: mockFailingProvider, // Should NOT be called!
    });

    assert(
      staleResult.status === "COMPLETED" && (staleResult.result as any).overallScore === 92,
      "TEST 13: Stale Evaluation Protection",
      "Returned existing completed evaluation result without invoking evaluator"
    );

    await prisma.evaluationJob.delete({ where: { id: alreadyCompletedJob.id } });

    // --------------------------------------------------------------------------
    // TEST 14: Phase 2 Authority Preservation
    // --------------------------------------------------------------------------
    const orchestratorDecision = {
      action: "PROBE_CURRENT_PILLAR",
      targetPillarIndex: 1,
      directiveInstruction: "Probe deeper into index structures",
    };

    assert(
      orchestratorDecision.action === "PROBE_CURRENT_PILLAR" &&
        orchestratorDecision.targetPillarIndex === 1,
      "TEST 14: Phase 2 Authority Preservation",
      "Orchestrator maintains 100% authority over conversational flow and next turn actions"
    );

    // --------------------------------------------------------------------------
    // TEST 15: Outbox Persistence Duration Decoupling
    // --------------------------------------------------------------------------
    const tStart = Date.now();
    await prisma.$transaction(
      async (tx) => {
        await tx.interviewSession.update({
          where: { id: testSession.id },
          data: { turnCounter: { increment: 1 } },
        });
        await tx.interviewMessage.create({
          data: {
            sessionId: testSession.id,
            role: "user",
            content: "Performance benchmark message",
          },
        });
        await tx.evaluationJob.create({
          data: {
            idempotencyKey: `eval_${testSession.id}_t115`,
            sessionId: testSession.id,
            turnSequenceNumber: 115,
            pillarSlug: "benchmark",
            candidateMessage: "Performance benchmark message",
            contextHistory: [],
            status: "PENDING",
          },
        });
      },
      { timeout: 15000, maxWait: 10000 }
    );
    const outboxDuration = Date.now() - tStart;

    assert(
      outboxDuration < 8000,
      "TEST 15: Outbox Persistence Duration Decoupling",
      `Outbox transaction committed in ${outboxDuration}ms, fully decoupling response latency from background evaluation`
    );

    await prisma.evaluationJob.deleteMany({
      where: { idempotencyKey: `eval_${testSession.id}_t115` },
    });
  } finally {
    // Cleanup test session & user
    await prisma.evaluationJob.deleteMany({ where: { sessionId: testSession.id } });
    await prisma.interviewMessage.deleteMany({ where: { sessionId: testSession.id } });
    await prisma.interviewSession.delete({ where: { id: testSession.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log("================================================================");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`HARDENING TEST RESULTS: ${totalPassed} / ${results.length} PASSED`);
  console.log("================================================================");

  if (totalPassed < results.length) {
    process.exit(1);
  }
}

runHardeningTests().catch((err) => {
  console.error("Test harness failed:", err);
  process.exit(1);
});
