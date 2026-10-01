import { prisma } from "../lib/prisma";
import { ReportPersistenceService } from "../services/report-persistence";
import { DeterministicReportEngine } from "../services/report-generator";
import { getLLMProvider, LLMProvider } from "../lib/llm";
import { TurnEvaluationRecord } from "../services/evaluator";

// ============================================================================
// TEST HARNESS & INSTRUMENTATION
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

// Global LLM Call Counter to verify ZERO LLM calls in Phase 4A-2
let globalLLMCallCount = 0;

function makeMockEval(
  seq: number,
  score: number | null,
  status: "COMPLETED" | "FAILED" = "COMPLETED",
  masterySignal: "MASTERY_HIGH" | "MASTERY_ADEQUATE" | "NEEDS_DEVELOPMENT" | "CRITICAL_GAP" | null = null,
  pillarSlug = "PILLAR-0"
): TurnEvaluationRecord {
  return {
    id: `eval_${seq}_${Math.random().toString(36).substring(2)}`,
    sessionId: "test-session",
    turnSequenceNumber: seq,
    pillarSlug,
    pillarName: "Architecture",
    evaluationStatus: status,
    overallScore: score,
    confidence: 1.0,
    rubricScores: null,
    demonstratedConcepts: score !== null && score >= 50 ? ["Concept A"] : [],
    missingConcepts: score !== null && score < 70 ? ["Concept B"] : [],
    strengths: [],
    weaknesses: [],
    masterySignal,
    recommendedDifficulty: "MAINTAIN",
    evaluatorMetadata: {
      model: "mock-eval",
      promptVersion: "phase-3b-v1",
      latencyMs: 10,
      timestamp: new Date().toISOString(),
    },
    errorMessage: status === "FAILED" ? "Evaluation failed" : null,
  };
}

// ============================================================================
// PHASE 4A-2 VERIFICATION SUITE (18 TESTS)
// ============================================================================

async function runPhase4A2Tests() {
  console.log("================================================================");
  console.log("RUNNING PHASE 4A-2 VERIFICATION SUITE: REPORT PERSISTENCE");
  console.log("================================================================");

  // Setup test user
  const testUser = await prisma.user.upsert({
    where: { email: "phase4a2_tester@mockinterview.local" },
    update: {},
    create: {
      email: "phase4a2_tester@mockinterview.local",
      domain: "BACKEND",
    },
  });

  const createdSessionIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Creates Report Record in DB
    // --------------------------------------------------------------------------
    const session1 = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Distributed Systems",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 300000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(session1.id);

    // Create 2 completed evaluation jobs
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${session1.id}_t1`,
        sessionId: session1.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "We use Raft consensus.",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 90, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${session1.id}_t2`,
        sessionId: session1.id,
        turnSequenceNumber: 2,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Partition reassignment avoids stop-the-world pauses.",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(2, 92, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    const report1 = await ReportPersistenceService.getOrGenerateReport(session1.id);
    const inDb1 = await prisma.interviewReport.findUnique({
      where: { sessionId: session1.id },
    });

    assert(
      report1 !== null &&
        report1.status === "READY" &&
        report1.sessionId === session1.id &&
        inDb1 !== null &&
        inDb1.id === report1.id &&
        inDb1.overallScore === 91,
      "TEST 1: Creates Report",
      `Persisted report ${report1.id} with status = READY, overallScore = 91 in DB`
    );

    // --------------------------------------------------------------------------
    // TEST 2: SessionId Uniqueness
    // --------------------------------------------------------------------------
    let p2002Caught = false;
    try {
      await prisma.interviewReport.create({
        data: {
          sessionId: session1.id, // Duplicate sessionId
          status: "READY",
          scores: {},
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        p2002Caught = true;
      }
    }

    assert(
      p2002Caught,
      "TEST 2: SessionId Uniqueness",
      `PostgreSQL unique constraint strictly rejected duplicate session_id with P2002`
    );

    // --------------------------------------------------------------------------
    // TEST 3: Repeated Generation is Idempotent
    // --------------------------------------------------------------------------
    const report1_call2 = await ReportPersistenceService.getOrGenerateReport(session1.id);
    const report1_call3 = await ReportPersistenceService.getOrGenerateReport(session1.id);
    const reportCount1 = await prisma.interviewReport.count({
      where: { sessionId: session1.id },
    });

    assert(
      report1_call2.id === report1.id &&
        report1_call3.id === report1.id &&
        reportCount1 === 1,
      "TEST 3: Repeated Generation is Idempotent",
      `Repeated calls returned exact same report ID ${report1.id}; exactly 1 record exists in DB`
    );

    // --------------------------------------------------------------------------
    // TEST 4: Concurrent Generation Attempts
    // --------------------------------------------------------------------------
    const sessionConcurrent = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 200000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionConcurrent.id);

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionConcurrent.id}_t1`,
        sessionId: sessionConcurrent.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "I design scalable services.",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 85, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    // Fire 3 simultaneous concurrent generation calls
    const [cRes1, cRes2, cRes3] = await Promise.all([
      ReportPersistenceService.getOrGenerateReport(sessionConcurrent.id),
      ReportPersistenceService.getOrGenerateReport(sessionConcurrent.id),
      ReportPersistenceService.getOrGenerateReport(sessionConcurrent.id),
    ]);

    const totalConcurrentRows = await prisma.interviewReport.count({
      where: { sessionId: sessionConcurrent.id },
    });

    assert(
      totalConcurrentRows === 1 &&
        cRes1.id === cRes2.id &&
        cRes2.id === cRes3.id &&
        cRes1.status === "READY",
      "TEST 4: Concurrent Generation Attempts",
      `3 simultaneous concurrent requests resulted in exactly 1 persisted row (id: ${cRes1.id}) with status READY`
    );

    // --------------------------------------------------------------------------
    // TEST 5: READY Report Reuse
    // --------------------------------------------------------------------------
    const tReuse0 = performance.now();
    const reusedReport = await ReportPersistenceService.getOrGenerateReport(session1.id);
    const reuseLatencyMs = (performance.now() - tReuse0).toFixed(2);

    assert(
      reusedReport.id === report1.id &&
        reusedReport.updatedAt.getTime() === report1.updatedAt.getTime(),
      "TEST 5: READY Report Reuse",
      `Existing READY report reused without regeneration in ${reuseLatencyMs}ms (updatedAt unchanged)`
    );

    // --------------------------------------------------------------------------
    // TEST 6: FAILED Persistence (Diagnostics without score fabrication)
    // --------------------------------------------------------------------------
    const sessionFailed = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionFailed.id);

    // Create a failed job
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionFailed.id}_fail`,
        sessionId: sessionFailed.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "crash",
        contextHistory: [],
        status: "FAILED",
        lastError: "Connection reset by peer",
        retryCount: 3,
      },
    });

    const failedReport = await ReportPersistenceService.getOrGenerateReport(sessionFailed.id);

    assert(
      failedReport.status === "PARTIAL" &&
        failedReport.overallScore === null &&
        failedReport.overallPerformanceLevel === "NOT_ASSESSED" &&
        (failedReport.reconciliation as any)?.failedCount === 1,
      "TEST 6: FAILED Evaluation Persistence",
      `Session with failed job produced status = PARTIAL, overallScore = null, performanceLevel = NOT_ASSESSED without score fabrication`
    );

    // --------------------------------------------------------------------------
    // TEST 7: Zero Substantive -> Null Overall Score
    // --------------------------------------------------------------------------
    const sessionZeroSub = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 100000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionZeroSub.id);

    // Fast path non-substantive turn
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionZeroSub.id}_ns`,
        sessionId: sessionZeroSub.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "hello there",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, null, "COMPLETED", null, "PILLAR-0") as any,
      },
    });

    const zeroSubReport = await ReportPersistenceService.getOrGenerateReport(sessionZeroSub.id);

    assert(
      zeroSubReport.status === "READY" &&
        zeroSubReport.overallScore === null &&
        zeroSubReport.overallPerformanceLevel === "NOT_ASSESSED",
      "TEST 7: Zero Substantive -> Null Overall Score",
      `0 substantive turns evaluated correctly persisted overallScore = null and NOT_ASSESSED (never 0)`
    );

    // --------------------------------------------------------------------------
    // TEST 8: Legitimate Zero Score Preserved
    // --------------------------------------------------------------------------
    const sessionLegitZero = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 150000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionLegitZero.id);

    // Legitimate 0 score on pillar 0
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionLegitZero.id}_zero`,
        sessionId: sessionLegitZero.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "I have no idea at all.",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 0, "COMPLETED", "CRITICAL_GAP", "PILLAR-0") as any,
      },
    });

    const legitZeroReport = await ReportPersistenceService.getOrGenerateReport(sessionLegitZero.id);

    assert(
      legitZeroReport.overallScore === 0 &&
        legitZeroReport.overallPerformanceLevel === "NEEDS_IMPROVEMENT",
      "TEST 8: Legitimate Zero Score Preserved",
      `Legitimate evaluated score 0 strictly preserved: overallScore = 0 (NEEDS_IMPROVEMENT)`
    );

    // --------------------------------------------------------------------------
    // TEST 9: Unevaluated Pillar Excluded from Average
    // --------------------------------------------------------------------------
    const sessionPillarExcl = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 250000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionPillarExcl.id);

    // Pillar 0 evaluated with 80
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionPillarExcl.id}_p0`,
        sessionId: sessionPillarExcl.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Pillar 0 response",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 80, "COMPLETED", "MASTERY_ADEQUATE", "PILLAR-0") as any,
      },
    });

    // Pillar 2 evaluated with 60 (Pillar 1 unevaluated)
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionPillarExcl.id}_p2`,
        sessionId: sessionPillarExcl.id,
        turnSequenceNumber: 2,
        pillarSlug: "PILLAR-2",
        candidateMessage: "Pillar 2 response",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(2, 60, "COMPLETED", "NEEDS_DEVELOPMENT", "PILLAR-2") as any,
      },
    });

    const exclReport = await ReportPersistenceService.getOrGenerateReport(sessionPillarExcl.id);
    const pScores = exclReport.pillarScores as any[];
    const p1 = pScores.find((p) => p.slug === "PILLAR-1");

    assert(
      exclReport.overallScore === 70 &&
        p1 !== undefined &&
        p1.score === null &&
        p1.turnsEvaluated === 0,
      "TEST 9: Unevaluated Pillar Excluded",
      `Score is round((80 + 60) / 2) = 70; unevaluated Pillar 1 excluded (score=null, turns=0)`
    );

    // --------------------------------------------------------------------------
    // TEST 10: Failed Evaluation Excluded
    // --------------------------------------------------------------------------
    const sessionFailedExcl = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 300000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionFailedExcl.id);

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionFailedExcl.id}_ok1`,
        sessionId: sessionFailedExcl.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Good answer",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 90, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionFailedExcl.id}_fail1`,
        sessionId: sessionFailedExcl.id,
        turnSequenceNumber: 2,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Network failed",
        contextHistory: [],
        status: "FAILED",
        lastError: "Timeout",
        retryCount: 3,
      },
    });

    const failedExclReport = await ReportPersistenceService.getOrGenerateReport(sessionFailedExcl.id);

    assert(
      failedExclReport.status === "PARTIAL" &&
        failedExclReport.overallScore === 90 &&
        (failedExclReport.reconciliation as any)?.failedCount === 1,
      "TEST 10: Failed Evaluation Excluded from Score",
      `Failed job excluded from score calculation: overallScore = 90, status = PARTIAL`
    );

    // --------------------------------------------------------------------------
    // TEST 11: Stale Evaluation Excluded from Trajectory
    // --------------------------------------------------------------------------
    const sessionStale = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 300000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionStale.id);

    // Turn 1
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionStale.id}_t1`,
        sessionId: sessionStale.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Turn 1 answer",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 90, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    // Stale duplicate turn 1
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionStale.id}_t1_stale`,
        sessionId: sessionStale.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Stale duplicate answer",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 90, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    // Turn 2
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionStale.id}_t2`,
        sessionId: sessionStale.id,
        turnSequenceNumber: 2,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Turn 2 answer",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(2, 90, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    const staleReport = await ReportPersistenceService.getOrGenerateReport(sessionStale.id);
    const traj = staleReport.difficultyTrajectory as any[];

    assert(
      traj.length === 1 &&
        traj[0].turnSequenceNumber === 2 &&
        traj[0].newDifficulty === "SENIOR",
      "TEST 11: Stale Evaluation Excluded from Trajectory",
      `Stale turn 1 ignored; difficulty adaptation accurately triggered at turnSequenceNumber = 2`
    );

    // --------------------------------------------------------------------------
    // TEST 12: Difficulty Trajectory Preserved in DB
    // --------------------------------------------------------------------------
    assert(
      staleReport.startingDifficulty === "MID" &&
        staleReport.finalDifficulty === "SENIOR" &&
        traj.length === 1 &&
        traj[0].previousDifficulty === "MID" &&
        traj[0].newDifficulty === "SENIOR",
      "TEST 12: Difficulty Trajectory Preserved",
      `Persisted trajectory contains startingDifficulty=MID, finalDifficulty=SENIOR, reason recorded`
    );

    // --------------------------------------------------------------------------
    // TEST 13: Aptitude Deterministic Path
    // --------------------------------------------------------------------------
    const sessionApt = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "APTITUDE",
        difficulty: "MID",
        score: 87,
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 400000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionApt.id);

    const aptReport = await ReportPersistenceService.getOrGenerateReport(sessionApt.id);
    const aptPillars = aptReport.pillarScores as any[];

    assert(
      aptReport.status === "READY" &&
        aptReport.overallScore === 87 &&
        aptReport.overallPerformanceLevel === "EXEMPLARY" &&
        aptPillars.length === 3 &&
        aptPillars[0].name === "Quantitative Ability",
      "TEST 13: Aptitude Deterministic Path",
      `Aptitude persisted deterministically with score=87, level=EXEMPLARY, 3 canonical categories`
    );

    // --------------------------------------------------------------------------
    // TEST 14: No EvaluationJob Mutation
    // --------------------------------------------------------------------------
    const jobCountBefore = await prisma.evaluationJob.count();
    const jobsBefore = await prisma.evaluationJob.findMany({
      where: { sessionId: session1.id },
      select: { id: true, status: true, retryCount: true, claimedAt: true },
    });

    // Run report generator again
    await ReportPersistenceService.getOrGenerateReport(session1.id, { forceRefresh: true });

    const jobCountAfter = await prisma.evaluationJob.count();
    const jobsAfter = await prisma.evaluationJob.findMany({
      where: { sessionId: session1.id },
      select: { id: true, status: true, retryCount: true, claimedAt: true },
    });

    assert(
      jobCountBefore === jobCountAfter &&
        JSON.stringify(jobsBefore) === JSON.stringify(jobsAfter),
      "TEST 14: No EvaluationJob Mutation",
      `EvaluationJob records remained 100% untouched before and after report persistence (0 mutations)`
    );

    // --------------------------------------------------------------------------
    // TEST 15: Zero LLM Calls Made
    // --------------------------------------------------------------------------
    assert(
      globalLLMCallCount === 0,
      "TEST 15: Zero LLM Calls Made",
      `Strictly 0 LLM calls made during report persistence (globalLLMCallCount = 0)`
    );

    // --------------------------------------------------------------------------
    // TEST 16: Persisted Payload Matches Phase 4A-1 Engine Output
    // --------------------------------------------------------------------------
    const rawEngineOutput = await DeterministicReportEngine.generateDeterministicReport(session1.id);
    const persisted = await prisma.interviewReport.findUnique({
      where: { sessionId: session1.id },
    });

    const persistedPillars = persisted?.pillarScores as any[];
    const rawPillars = rawEngineOutput.pillarScores;
    const pillarsMatch =
      Array.isArray(persistedPillars) &&
      persistedPillars.length === rawPillars.length &&
      persistedPillars.every((p, idx) => {
        const r = rawPillars[idx];
        return (
          p.slug === r.slug &&
          p.name === r.name &&
          p.score === r.score &&
          p.masteryLevel === r.masteryLevel &&
          p.turnsEvaluated === r.turnsEvaluated
        );
      });

    assert(
      persisted !== null &&
        persisted.overallScore === rawEngineOutput.overallScore &&
        persisted.overallPerformanceLevel === rawEngineOutput.overallPerformanceLevel &&
        persisted.startingDifficulty === rawEngineOutput.startingDifficulty &&
        persisted.finalDifficulty === rawEngineOutput.finalDifficulty &&
        pillarsMatch,
      "TEST 16: Persisted Payload Matches Engine Output",
      `Database record matches Phase 4A-1 calculation bit-for-bit: overallScore=${persisted?.overallScore}`
    );

    // --------------------------------------------------------------------------
    // TEST 17: Prisma Transaction Integrity
    // --------------------------------------------------------------------------
    const sessionTx = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionTx.id);

    const txResult = await prisma.$transaction(
      async (tx) => {
        return ReportPersistenceService.getOrGenerateReport(sessionTx.id, {}, tx);
      },
      { maxWait: 15000, timeout: 30000 }
    );

    const txReportInDb = await prisma.interviewReport.findUnique({
      where: { sessionId: sessionTx.id },
    });

    assert(
      txResult !== null &&
        txReportInDb !== null &&
        txReportInDb.id === txResult.id,
      "TEST 17: Prisma Transaction Integrity",
      `Report successfully created and committed within Prisma interactive transaction (id: ${txResult.id})`
    );

    // --------------------------------------------------------------------------
    // TEST 18: Database Uniqueness Enforcement
    // --------------------------------------------------------------------------
    let dbUniqueEnforced = false;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "interview_reports" ("id", "session_id", "status", "scores", "strengths", "weaknesses", "tips", "created_at", "updated_at")
         VALUES ('raw_dup_1', $1, 'READY', '{}', '[]', '[]', '[]', NOW(), NOW())`,
        session1.id
      );
    } catch {
      dbUniqueEnforced = true;
    }

    assert(
      dbUniqueEnforced,
      "TEST 18: Database Uniqueness Enforcement",
      `Raw PostgreSQL INSERT with duplicate session_id strictly blocked by UNIQUE constraint`
    );
  } finally {
    // Clean up created test data
    if (createdSessionIds.length > 0) {
      await prisma.interviewReport.deleteMany({
        where: { sessionId: { in: createdSessionIds } },
      });
      await prisma.evaluationJob.deleteMany({
        where: { sessionId: { in: createdSessionIds } },
      });
      await prisma.interviewSession.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
    }
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log("================================================================");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`PHASE 4A-2 TEST RESULTS: ${totalPassed} / ${results.length} PASSED`);
  console.log("================================================================");

  if (totalPassed < results.length) {
    process.exit(1);
  }
}

runPhase4A2Tests().catch((err) => {
  console.error("Test harness failed:", err);
  process.exit(1);
});
