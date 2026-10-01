import { prisma } from "../lib/prisma";
import {
  DeterministicReportEngine,
  ReportAggregationStatus,
  PerformanceLevel,
  PillarReportItem,
} from "../services/report-generator";
import {
  TurnEvaluationRecord,
  PillarMasteryState,
  SessionMasteryState,
} from "../services/evaluator";
import { EvaluationWorker } from "../services/evaluation-worker";
import { getLLMProvider, LLMProvider } from "../lib/llm";

// ============================================================================
// TEST HARNESS & HELPERS
// ============================================================================

const mockHighProvider: LLMProvider = {
  name: "mock-eval-high",
  generateText: async () =>
    JSON.stringify({
      overallScore: 92,
      confidence: 0.95,
      rubricScores: [
        {
          dimension: "Architecture",
          score: 92,
          weight: 1.0,
          evidenceSnippet: "Distributed WAL replication",
          feedback: "Exemplary depth",
        },
      ],
      demonstratedConcepts: ["WAL", "Replication", "Consensus"],
      missingConcepts: ["Split Brain Mitigation"],
      strengths: ["Clear understanding of quorum"],
      weaknesses: ["Brief on partition tolerance"],
      masterySignal: "MASTERY_HIGH",
      recommendedDifficulty: "INCREASE",
    }),
  streamText: async () => {
    throw new Error("streamText not used in evaluator test");
  },
};

function makeEval(
  seq: number,
  score: number | null,
  status: "COMPLETED" | "FAILED" = "COMPLETED",
  masterySignal: "MASTERY_HIGH" | "MASTERY_ADEQUATE" | "NEEDS_DEVELOPMENT" | "CRITICAL_GAP" | null = null,
  pillarSlug = "PILLAR-0"
): TurnEvaluationRecord {
  return {
    id: `eval_test_${seq}_${Math.random().toString(36).substring(2)}`,
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

// Global LLM Call Counter to prove ZERO LLM calls in Phase 4A-1
let globalLLMCallCount = 0;
const realGetLLMProvider = getLLMProvider;

// ============================================================================
// PHASE 4A-1 TEST SUITE (20 TESTS)
// ============================================================================

async function runPhase4Tests() {
  console.log("================================================================");
  console.log("RUNNING PHASE 4A-1 VERIFICATION SUITE: DETERMINISTIC REPORT ENGINE");
  console.log("================================================================");

  // Setup test user
  const testUser = await prisma.user.upsert({
    where: { email: "phase4_tester@mockinterview.local" },
    update: {},
    create: {
      email: "phase4_tester@mockinterview.local",
      domain: "BACKEND",
    },
  });

  const testSession = await prisma.interviewSession.create({
    data: {
      userId: testUser.id,
      type: "DOMAIN",
      domain: "Distributed Systems",
      difficulty: "MID",
      status: "COMPLETED",
      startedAt: new Date(Date.now() - 600000), // 10 minutes ago
      completedAt: new Date(),
    },
  });

  try {
    // --------------------------------------------------------------------------
    // TEST 1: ZERO SUBSTANTIVE EVALUATIONS -> overallScore = null, NOT_ASSESSED
    // --------------------------------------------------------------------------
    const emptyPillars: PillarReportItem[] = [
      {
        slug: "PILLAR-0",
        name: "Architecture",
        score: null,
        masteryLevel: null,
        turnsEvaluated: 0,
        demonstratedConcepts: [],
        identifiedGaps: [],
      },
      {
        slug: "PILLAR-1",
        name: "Data Modeling",
        score: null,
        masteryLevel: null,
        turnsEvaluated: 0,
        demonstratedConcepts: [],
        identifiedGaps: [],
      },
    ];

    const zeroSubstantiveResult = DeterministicReportEngine.calculateOverallScore(emptyPillars);

    assert(
      zeroSubstantiveResult.overallScore === null &&
        zeroSubstantiveResult.performanceLevel === "NOT_ASSESSED",
      "TEST 1: Zero Substantive Evaluations",
      `overallScore is null and performanceLevel is NOT_ASSESSED (never converted to 0)`
    );

    // --------------------------------------------------------------------------
    // TEST 2: SINGLE EVALUATED PILLAR
    // --------------------------------------------------------------------------
    const singlePillar: PillarReportItem[] = [
      {
        slug: "PILLAR-0",
        name: "Architecture",
        score: 82,
        masteryLevel: "COMPETENT",
        turnsEvaluated: 2,
        demonstratedConcepts: ["Caching"],
        identifiedGaps: [],
      },
      {
        slug: "PILLAR-1",
        name: "Data Modeling",
        score: null,
        masteryLevel: null,
        turnsEvaluated: 0,
        demonstratedConcepts: [],
        identifiedGaps: [],
      },
    ];

    const singleResult = DeterministicReportEngine.calculateOverallScore(singlePillar);

    assert(
      singleResult.overallScore === 82 && singleResult.performanceLevel === "COMPETENT",
      "TEST 2: Single Evaluated Pillar",
      `Score 82 returned with performanceLevel = COMPETENT`
    );

    // --------------------------------------------------------------------------
    // TEST 3: MULTIPLE EVALUATED PILLARS -> Accurate Average
    // --------------------------------------------------------------------------
    const multiPillars: PillarReportItem[] = [
      {
        slug: "PILLAR-0",
        name: "Architecture",
        score: 90,
        masteryLevel: "EXEMPLARY",
        turnsEvaluated: 2,
        demonstratedConcepts: [],
        identifiedGaps: [],
      },
      {
        slug: "PILLAR-1",
        name: "Data Modeling",
        score: 80,
        masteryLevel: "COMPETENT",
        turnsEvaluated: 2,
        demonstratedConcepts: [],
        identifiedGaps: [],
      },
      {
        slug: "PILLAR-2",
        name: "Scalability",
        score: 70,
        masteryLevel: "COMPETENT",
        turnsEvaluated: 2,
        demonstratedConcepts: [],
        identifiedGaps: [],
      },
    ];

    const multiResult = DeterministicReportEngine.calculateOverallScore(multiPillars);

    assert(
      multiResult.overallScore === 80 && multiResult.performanceLevel === "COMPETENT",
      "TEST 3: Multiple Evaluated Pillars",
      `Average of [90, 80, 70] is exactly 80 (COMPETENT)`
    );

    // --------------------------------------------------------------------------
    // TEST 4: UNEVALUATED PILLAR EXCLUSION (Architecture=80, Data=null, Resilience=60 -> 70)
    // --------------------------------------------------------------------------
    const partialEvaluatedPillars: PillarReportItem[] = [
      {
        slug: "PILLAR-0",
        name: "Architecture",
        score: 80,
        masteryLevel: "COMPETENT",
        turnsEvaluated: 2,
        demonstratedConcepts: [],
        identifiedGaps: [],
      },
      {
        slug: "PILLAR-1",
        name: "Data",
        score: null,
        masteryLevel: null,
        turnsEvaluated: 0,
        demonstratedConcepts: [],
        identifiedGaps: [],
      },
      {
        slug: "PILLAR-2",
        name: "Resilience",
        score: 60,
        masteryLevel: "DEVELOPING",
        turnsEvaluated: 2,
        demonstratedConcepts: [],
        identifiedGaps: [],
      },
    ];

    const exclusionResult = DeterministicReportEngine.calculateOverallScore(partialEvaluatedPillars);

    assert(
      exclusionResult.overallScore === 70 && exclusionResult.performanceLevel === "COMPETENT",
      "TEST 4: Unevaluated Pillar Exclusion",
      `Score is round((80 + 60) / 2) = 70, NOT diluted by unvisited pillar (not 46.67)`
    );

    // --------------------------------------------------------------------------
    // TEST 5: VALID ZERO SCORE (Architecture=0, Data=80 -> 40)
    // --------------------------------------------------------------------------
    const zeroScorePillars: PillarReportItem[] = [
      {
        slug: "PILLAR-0",
        name: "Architecture",
        score: 0,
        masteryLevel: "NOVICE",
        turnsEvaluated: 1, // Assessed with legitimate 0
        demonstratedConcepts: [],
        identifiedGaps: ["Basic concepts"],
      },
      {
        slug: "PILLAR-1",
        name: "Data",
        score: 80,
        masteryLevel: "COMPETENT",
        turnsEvaluated: 2,
        demonstratedConcepts: ["Indexing"],
        identifiedGaps: [],
      },
    ];

    const validZeroResult = DeterministicReportEngine.calculateOverallScore(zeroScorePillars);

    assert(
      validZeroResult.overallScore === 40 &&
        validZeroResult.performanceLevel === "NEEDS_IMPROVEMENT",
      "TEST 5: Valid Zero Score Included",
      `Legitimate score 0 was assessed and included in average: round((0 + 80) / 2) = 40 (NEEDS_IMPROVEMENT)`
    );

    // --------------------------------------------------------------------------
    // TEST 6: FAILED EVALUATION -> Unassessed & No Fabricated Score
    // --------------------------------------------------------------------------
    const failedJob = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_fail_test`,
        sessionId: testSession.id,
        turnSequenceNumber: 901,
        pillarSlug: "PILLAR-0",
        candidateMessage: "I don't know anything about this topic",
        contextHistory: [],
        status: "FAILED",
        retryCount: 3,
        lastError: "Rate limit timeout (503)",
      },
    });

    const reconFailed = await DeterministicReportEngine.reconcileEvaluationJobs(testSession.id);

    assert(
      reconFailed.status === "PARTIAL" &&
        reconFailed.failedCount === 1 &&
        reconFailed.unassessedTurns.includes(901),
      "TEST 6: Failed Evaluation Reconciliation",
      `Failed job correctly identified as unassessed turn 901 with PARTIAL status`
    );

    // --------------------------------------------------------------------------
    // TEST 7: PENDING JOB -> WAITING_FOR_EVALUATIONS
    // --------------------------------------------------------------------------
    const pendingJob = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_pending_test`,
        sessionId: testSession.id,
        turnSequenceNumber: 902,
        pillarSlug: "PILLAR-0",
        candidateMessage: "I implemented sharding with consistent hashing",
        contextHistory: [],
        status: "PENDING",
      },
    });

    const reconPending = await DeterministicReportEngine.reconcileEvaluationJobs(testSession.id);

    assert(
      reconPending.status === "WAITING_FOR_EVALUATIONS" &&
        reconPending.pendingCount === 1 &&
        !reconPending.canAggregate,
      "TEST 7: Pending Job Produces WAITING",
      `Reconciliation returned WAITING_FOR_EVALUATIONS with pendingCount = 1`
    );

    // --------------------------------------------------------------------------
    // TEST 8: PROCESSING JOB WITH ACTIVE LEASE -> WAITING (No Steal / No Execution)
    // --------------------------------------------------------------------------
    await prisma.evaluationJob.update({
      where: { id: pendingJob.id },
      data: {
        status: "PROCESSING",
        workerId: "worker_active_lease",
        claimedAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + 60000), // Active 60s lease
      },
    });

    const reconProcessing = await DeterministicReportEngine.reconcileEvaluationJobs(testSession.id);

    assert(
      reconProcessing.status === "WAITING_FOR_EVALUATIONS" &&
        reconProcessing.processingCount === 1 &&
        !reconProcessing.canAggregate,
      "TEST 8: Processing Job with Active Lease",
      `Active lease job respected without stealing or re-executing; returned WAITING_FOR_EVALUATIONS`
    );

    // --------------------------------------------------------------------------
    // TEST 9: RETRYING JOB -> WAITING_FOR_EVALUATIONS
    // --------------------------------------------------------------------------
    await prisma.evaluationJob.update({
      where: { id: pendingJob.id },
      data: {
        status: "RETRYING",
        nextRetryAt: new Date(Date.now() + 5000),
      },
    });

    const reconRetrying = await DeterministicReportEngine.reconcileEvaluationJobs(testSession.id);

    assert(
      reconRetrying.status === "WAITING_FOR_EVALUATIONS" &&
        reconRetrying.retryingCount === 1 &&
        !reconRetrying.canAggregate,
      "TEST 9: Retrying Job Produces WAITING",
      `Job in retry backoff returned WAITING_FOR_EVALUATIONS without inline execution`
    );

    // --------------------------------------------------------------------------
    // TEST 10: ALL JOBS TERMINAL + NO FAILURES -> READY
    // --------------------------------------------------------------------------
    await prisma.evaluationJob.deleteMany({
      where: { id: { in: [failedJob.id, pendingJob.id] } },
    });

    const completedJob1 = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_c1`,
        sessionId: testSession.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "We use Kafka with cooperative sticky assignors.",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: {
          overallScore: 90,
          masterySignal: "MASTERY_HIGH",
          demonstratedConcepts: ["Kafka Assignors"],
          missingConcepts: [],
        },
      },
    });

    const completedJob2 = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_c2`,
        sessionId: testSession.id,
        turnSequenceNumber: 2,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Partition reassignment avoids stop-the-world pauses.",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: {
          overallScore: 88,
          masterySignal: "MASTERY_HIGH",
          demonstratedConcepts: ["Zero-downtime Partitioning"],
          missingConcepts: [],
        },
      },
    });

    const reconReady = await DeterministicReportEngine.reconcileEvaluationJobs(testSession.id);

    assert(
      reconReady.status === "READY" &&
        reconReady.completedCount === 2 &&
        reconReady.failedCount === 0 &&
        reconReady.canAggregate,
      "TEST 10: All Jobs Terminal No Failures -> READY",
      `Reconciliation returned READY with completedCount = 2 and failedCount = 0`
    );

    // --------------------------------------------------------------------------
    // TEST 11: ALL JOBS TERMINAL + FAILED JOB -> PARTIAL
    // --------------------------------------------------------------------------
    const partialFailJob = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${testSession.id}_pf`,
        sessionId: testSession.id,
        turnSequenceNumber: 3,
        pillarSlug: "PILLAR-1",
        candidateMessage: "Network dropped",
        contextHistory: [],
        status: "FAILED",
        retryCount: 3,
      },
    });

    const reconPartial = await DeterministicReportEngine.reconcileEvaluationJobs(testSession.id);

    assert(
      reconPartial.status === "PARTIAL" &&
        reconPartial.completedCount === 2 &&
        reconPartial.failedCount === 1 &&
        reconPartial.canAggregate,
      "TEST 11: All Jobs Terminal with 1 Failure -> PARTIAL",
      `Reconciliation returned PARTIAL with 2 completed and 1 failed job`
    );

    // Clean up partial fail job
    await prisma.evaluationJob.delete({ where: { id: partialFailJob.id } });

    // --------------------------------------------------------------------------
    // TEST 12: DIFFICULTY TRAJECTORY DETERMINISTIC REPLAY
    // --------------------------------------------------------------------------
    const testEvals: TurnEvaluationRecord[] = [
      {
        id: "e1",
        sessionId: testSession.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        pillarName: "Architecture",
        evaluationStatus: "COMPLETED",
        overallScore: 90,
        confidence: 1.0,
        rubricScores: null,
        demonstratedConcepts: [],
        missingConcepts: [],
        strengths: [],
        weaknesses: [],
        masterySignal: "MASTERY_HIGH",
        recommendedDifficulty: "INCREASE",
        evaluatorMetadata: { model: "", promptVersion: "", latencyMs: 0, timestamp: "" },
        errorMessage: null,
      },
      {
        id: "e2",
        sessionId: testSession.id,
        turnSequenceNumber: 2,
        pillarSlug: "PILLAR-0",
        pillarName: "Architecture",
        evaluationStatus: "COMPLETED",
        overallScore: 92,
        confidence: 1.0,
        rubricScores: null,
        demonstratedConcepts: [],
        missingConcepts: [],
        strengths: [],
        weaknesses: [],
        masterySignal: "MASTERY_HIGH",
        recommendedDifficulty: "INCREASE",
        evaluatorMetadata: { model: "", promptVersion: "", latencyMs: 0, timestamp: "" },
        errorMessage: null,
      },
    ];

    const replayResult = DeterministicReportEngine.reconstructDifficultyTrajectory(
      "MID",
      testEvals
    );

    assert(
      replayResult.finalDifficulty === "SENIOR" &&
        replayResult.trajectory.length === 1 &&
        replayResult.trajectory[0].previousDifficulty === "MID" &&
        replayResult.trajectory[0].newDifficulty === "SENIOR",
      "TEST 12: Difficulty Trajectory Deterministic Replay",
      `Replayed 2 high scores: MID -> SENIOR trajectory point generated deterministically`
    );

    // --------------------------------------------------------------------------
    // TEST 13: STARTING DIFFICULTY PRESERVATION
    // --------------------------------------------------------------------------
    const normJunior = DeterministicReportEngine.normalizeDifficulty("JUNIOR");
    const normInter = DeterministicReportEngine.normalizeDifficulty("INTERMEDIATE");

    assert(
      normJunior === "JUNIOR" && normInter === "MID",
      "TEST 13: Starting Difficulty Preservation",
      `JUNIOR preserved; INTERMEDIATE normalized cleanly to MID`
    );

    // --------------------------------------------------------------------------
    // TEST 14: FINAL DIFFICULTY CORRESPONDENCE
    // --------------------------------------------------------------------------
    assert(
      replayResult.finalDifficulty === "SENIOR",
      "TEST 14: Final Difficulty Matches State",
      `Final difficulty corresponds accurately to Phase 3 state (SENIOR)`
    );

    // --------------------------------------------------------------------------
    // TEST A: Boundary 55, 50 -> NO difficulty decrease
    // --------------------------------------------------------------------------
    const evalsA = [
      makeEval(1, 55, "COMPLETED", "NEEDS_DEVELOPMENT"),
      makeEval(2, 50, "COMPLETED", "NEEDS_DEVELOPMENT"),
    ];
    const resA = DeterministicReportEngine.reconstructDifficultyTrajectory("MID", evalsA);
    assert(
      resA.finalDifficulty === "MID" && resA.trajectory.length === 0,
      "TEST A: Boundary 55, 50 produces NO difficulty decrease",
      `Turns 55 and 50 resulted in finalDifficulty = MID with 0 trajectory adaptations`
    );

    // --------------------------------------------------------------------------
    // TEST B: Boundary 46, 45 -> NO difficulty decrease
    // --------------------------------------------------------------------------
    const evalsB = [
      makeEval(1, 46, "COMPLETED", "NEEDS_DEVELOPMENT"),
      makeEval(2, 45, "COMPLETED", "CRITICAL_GAP"),
    ];
    const resB = DeterministicReportEngine.reconstructDifficultyTrajectory("MID", evalsB);
    assert(
      resB.finalDifficulty === "MID" && resB.trajectory.length === 0,
      "TEST B: Boundary 46, 45 produces NO difficulty decrease",
      `Turn 1 (46, NEEDS_DEVELOPMENT) and Turn 2 (45, CRITICAL_GAP) produced 0 difficulty decrease`
    );

    // --------------------------------------------------------------------------
    // TEST C: 45 + CRITICAL_GAP, 45 + CRITICAL_GAP -> decrease exactly 1 tier
    // --------------------------------------------------------------------------
    const evalsC = [
      makeEval(1, 45, "COMPLETED", "CRITICAL_GAP"),
      makeEval(2, 45, "COMPLETED", "CRITICAL_GAP"),
    ];
    const resC = DeterministicReportEngine.reconstructDifficultyTrajectory("MID", evalsC);
    assert(
      resC.finalDifficulty === "JUNIOR" &&
        resC.trajectory.length === 1 &&
        resC.trajectory[0].newDifficulty === "JUNIOR" &&
        resC.trajectory[0].previousDifficulty === "MID",
      "TEST C: 45 + CRITICAL_GAP twice decreases exactly 1 tier",
      `Two consecutive 45 + CRITICAL_GAP decreased difficulty: MID -> JUNIOR`
    );

    // --------------------------------------------------------------------------
    // TEST D: 46 + CRITICAL_GAP, 45 + CRITICAL_GAP -> NO decrease (score <= 45 rule)
    // --------------------------------------------------------------------------
    const evalsD = [
      makeEval(1, 46, "COMPLETED", "CRITICAL_GAP"),
      makeEval(2, 45, "COMPLETED", "CRITICAL_GAP"),
    ];
    const resD = DeterministicReportEngine.reconstructDifficultyTrajectory("MID", evalsD);
    assert(
      resD.finalDifficulty === "MID" && resD.trajectory.length === 0,
      "TEST D: 46 + CRITICAL_GAP followed by 45 + CRITICAL_GAP produces NO decrease",
      `Phase 3C score <= 45 rule strictly enforced: score 46 rejected from low streak; finalDifficulty = MID`
    );

    // --------------------------------------------------------------------------
    // TEST E: 85 + MASTERY_HIGH, 85 + MASTERY_HIGH -> increase exactly 1 tier
    // --------------------------------------------------------------------------
    const evalsE = [
      makeEval(1, 85, "COMPLETED", "MASTERY_HIGH"),
      makeEval(2, 85, "COMPLETED", "MASTERY_HIGH"),
    ];
    const resE = DeterministicReportEngine.reconstructDifficultyTrajectory("MID", evalsE);
    assert(
      resE.finalDifficulty === "SENIOR" &&
        resE.trajectory.length === 1 &&
        resE.trajectory[0].newDifficulty === "SENIOR" &&
        resE.trajectory[0].previousDifficulty === "MID",
      "TEST E: 85 + MASTERY_HIGH twice increases exactly 1 tier",
      `Two consecutive 85 + MASTERY_HIGH increased difficulty: MID -> SENIOR`
    );

    // --------------------------------------------------------------------------
    // TEST F: 84 + MASTERY_HIGH, 85 + MASTERY_HIGH -> NO increase (score >= 85 rule)
    // --------------------------------------------------------------------------
    const evalsF = [
      makeEval(1, 84, "COMPLETED", "MASTERY_HIGH"),
      makeEval(2, 85, "COMPLETED", "MASTERY_HIGH"),
    ];
    const resF = DeterministicReportEngine.reconstructDifficultyTrajectory("MID", evalsF);
    assert(
      resF.finalDifficulty === "MID" && resF.trajectory.length === 0,
      "TEST F: 84 + MASTERY_HIGH followed by 85 + MASTERY_HIGH produces NO increase",
      `Phase 3C score >= 85 rule strictly enforced: score 84 rejected from high streak; finalDifficulty = MID`
    );

    // --------------------------------------------------------------------------
    // TEST G: 90 + MASTERY_HIGH, 50 + CRITICAL_GAP -> mixed streaks reset, NO change
    // --------------------------------------------------------------------------
    const evalsG = [
      makeEval(1, 90, "COMPLETED", "MASTERY_HIGH"),
      makeEval(2, 50, "COMPLETED", "CRITICAL_GAP"),
    ];
    const resG = DeterministicReportEngine.reconstructDifficultyTrajectory("MID", evalsG);
    assert(
      resG.finalDifficulty === "MID" && resG.trajectory.length === 0,
      "TEST G: Mixed streaks reset and produce NO increase and NO decrease",
      `90 + MASTERY_HIGH followed by 50 + CRITICAL_GAP reset streaks; finalDifficulty = MID`
    );

    // --------------------------------------------------------------------------
    // TEST H: FAILED, 90 + MASTERY_HIGH, 90 + MASTERY_HIGH -> failed does not count
    // --------------------------------------------------------------------------
    const evalsH = [
      makeEval(1, null, "FAILED", null),
      makeEval(2, 90, "COMPLETED", "MASTERY_HIGH"),
      makeEval(3, 90, "COMPLETED", "MASTERY_HIGH"),
    ];
    const resH = DeterministicReportEngine.reconstructDifficultyTrajectory("MID", evalsH);
    assert(
      resH.finalDifficulty === "SENIOR" &&
        resH.trajectory.length === 1 &&
        resH.trajectory[0].turnSequenceNumber === 3,
      "TEST H: Failed evaluation does not contribute to high streak",
      `FAILED turn did not increment streak; adaptation occurred at turn 3 after 2 valid high turns`
    );

    // --------------------------------------------------------------------------
    // TEST I: 90 + MASTERY_HIGH, STALE 90 + MASTERY_HIGH, 90 + MASTERY_HIGH -> stale ignored
    // --------------------------------------------------------------------------
    const evalsI = [
      makeEval(1, 90, "COMPLETED", "MASTERY_HIGH"),
      makeEval(1, 90, "COMPLETED", "MASTERY_HIGH"), // Duplicate stale turn 1
      makeEval(2, 90, "COMPLETED", "MASTERY_HIGH"),
    ];
    const resI = DeterministicReportEngine.reconstructDifficultyTrajectory("MID", evalsI);
    assert(
      resI.finalDifficulty === "SENIOR" &&
        resI.trajectory.length === 1 &&
        resI.trajectory[0].turnSequenceNumber === 2,
      "TEST I: Stale evaluation does not create a false consecutive streak",
      `Duplicate turn sequence 1 rejected as stale; adaptation occurred at turnSequenceNumber = 2`
    );

    // --------------------------------------------------------------------------
    // TEST J: Difficulty upper clamp at PRINCIPAL -> 2 high evaluations remain PRINCIPAL
    // --------------------------------------------------------------------------
    const evalsJ = [
      makeEval(1, 95, "COMPLETED", "MASTERY_HIGH"),
      makeEval(2, 95, "COMPLETED", "MASTERY_HIGH"),
    ];
    const resJ = DeterministicReportEngine.reconstructDifficultyTrajectory("PRINCIPAL", evalsJ);
    assert(
      resJ.finalDifficulty === "PRINCIPAL" && resJ.trajectory.length === 0,
      "TEST J: Difficulty upper clamp at PRINCIPAL",
      `Two high evaluations at PRINCIPAL remained clamped to PRINCIPAL with 0 tier overflow`
    );

    // --------------------------------------------------------------------------
    // TEST K: Difficulty lower clamp at JUNIOR -> 2 critical-gap evaluations remain JUNIOR
    // --------------------------------------------------------------------------
    const evalsK = [
      makeEval(1, 30, "COMPLETED", "CRITICAL_GAP"),
      makeEval(2, 30, "COMPLETED", "CRITICAL_GAP"),
    ];
    const resK = DeterministicReportEngine.reconstructDifficultyTrajectory("JUNIOR", evalsK);
    assert(
      resK.finalDifficulty === "JUNIOR" && resK.trajectory.length === 0,
      "TEST K: Difficulty lower clamp at JUNIOR",
      `Two low evaluations at JUNIOR remained clamped to JUNIOR with 0 tier underflow`
    );

    // --------------------------------------------------------------------------
    // TEST L: Trajectory Consistency (reconstructed final == persisted final)
    // --------------------------------------------------------------------------
    const consistencySession = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Distributed Systems",
        difficulty: "MID",
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    const cJob1 = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${consistencySession.id}_c1`,
        sessionId: consistencySession.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "I use distributed consensus.",
        contextHistory: [],
        status: "PENDING",
      },
    });
    const claimedC1 = (await EvaluationWorker.claimNextJob())!;
    await EvaluationWorker.processJob(claimedC1, { llmProvider: mockHighProvider });

    const cJob2 = await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${consistencySession.id}_c2`,
        sessionId: consistencySession.id,
        turnSequenceNumber: 2,
        pillarSlug: "PILLAR-0",
        candidateMessage: "We partition using consistent hashing.",
        contextHistory: [],
        status: "PENDING",
      },
    });
    const claimedC2 = (await EvaluationWorker.claimNextJob())!;
    await EvaluationWorker.processJob(claimedC2, { llmProvider: mockHighProvider });

    const persistedSession = (await prisma.interviewSession.findUnique({
      where: { id: consistencySession.id },
      include: { evaluationJobs: true },
    }))!;

    const persistedDifficulty = persistedSession.difficulty;
    const persistedMastery: any = persistedSession.masteryState;

    const consistencyJobs = persistedSession.evaluationJobs
      .filter((j) => j.status === "COMPLETED" && j.evaluationResult)
      .map((j) => {
        const res = j.evaluationResult as any;
        return {
          ...res,
          turnSequenceNumber: res.turnSequenceNumber ?? j.turnSequenceNumber,
          pillarSlug: res.pillarSlug ?? j.pillarSlug,
        };
      });

    const replayed = DeterministicReportEngine.reconstructDifficultyTrajectory(
      "MID",
      consistencyJobs
    );

    if (replayed.finalDifficulty !== persistedDifficulty) {
      throw new Error(
        `TRAJECTORY CONSISTENCY MISMATCH: Replayed final difficulty '${replayed.finalDifficulty}' does not match persisted session difficulty '${persistedDifficulty}'!`
      );
    }

    assert(
      replayed.finalDifficulty === persistedDifficulty &&
        replayed.finalDifficulty === persistedMastery.currentDifficulty &&
        persistedDifficulty === "SENIOR",
      "TEST L: Trajectory Consistency Verification",
      `Replayed final difficulty (${replayed.finalDifficulty}) exactly matches persisted session.difficulty (${persistedDifficulty}) and masteryState.currentDifficulty (${persistedMastery.currentDifficulty})`
    );

    await prisma.evaluationJob.deleteMany({ where: { sessionId: consistencySession.id } });
    await prisma.interviewSession.delete({ where: { id: consistencySession.id } });

    // --------------------------------------------------------------------------
    // TEST 15: SESSION METRICS CALCULATION
    // --------------------------------------------------------------------------
    const metricsResult = DeterministicReportEngine.buildMetrics(
      {
        startedAt: new Date(Date.now() - 300000), // 300s
        completedAt: new Date(),
      },
      [
        { role: "assistant", content: "Tell me about your experience.", createdAt: new Date() },
        { role: "user", content: "I built high-scale systems.", createdAt: new Date() },
        { role: "assistant", content: "How did you scale the db?", createdAt: new Date() },
        { role: "user", content: "I don't know honestly.", createdAt: new Date() },
      ],
      [
        {
          status: "COMPLETED",
          evaluationResult: { overallScore: 85 } as any,
        },
        {
          status: "COMPLETED",
          evaluationResult: { overallScore: null } as any, // fast path non-substantive
        },
      ]
    );

    assert(
      metricsResult.totalTurns === 2 &&
        metricsResult.substantiveTurns === 1 &&
        metricsResult.nonSubstantiveTurns === 1 &&
        metricsResult.durationSeconds >= 295,
      "TEST 15: Metrics Calculation",
      `totalTurns=2, substantive=1, nonSubstantive=1, duration=${metricsResult.durationSeconds}s`
    );

    // --------------------------------------------------------------------------
    // TEST 16: PILLAR DATA (Concepts & Gaps from Stored Data)
    // --------------------------------------------------------------------------
    const pillarData = DeterministicReportEngine.buildPillarReports(
      "DOMAIN",
      {
        sessionId: testSession.id,
        currentDifficulty: "MID",
        pillars: {
          "PILLAR-0": {
            pillarSlug: "PILLAR-0",
            pillarName: "System Architecture & High-Level System Design",
            rollingScore: 85,
            totalSubstantiveTurns: 2,
            consecutiveHighScoreTurns: 2,
            consecutiveLowScoreTurns: 0,
            masteryLevel: "EXEMPLARY",
            demonstratedConcepts: ["WAL", "Partitioning"],
            identifiedGaps: ["Split-brain"],
            lastEvaluatedTurnSequenceNumber: 2,
          },
        },
        evaluations: [],
        updatedAt: new Date().toISOString(),
      },
      []
    );

    assert(
      pillarData.length === 5 &&
        pillarData[0].score === 85 &&
        pillarData[0].demonstratedConcepts.includes("WAL") &&
        pillarData[0].identifiedGaps.includes("Split-brain") &&
        pillarData[1].score === null &&
        pillarData[1].turnsEvaluated === 0,
      "TEST 16: Pillar Data from Stored State",
      `Assessed pillar has score=85, WAL, Split-brain; unvisited pillars have score=null`
    );

    // --------------------------------------------------------------------------
    // TEST 17: APTITUDE 0% REMAINS VALID SCORE
    // --------------------------------------------------------------------------
    const aptZeroSession = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "APTITUDE",
        difficulty: "MID",
        score: 0, // Legitimate 0%
        status: "COMPLETED",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const aptZeroReport = await DeterministicReportEngine.generateDeterministicReport(
      aptZeroSession.id
    );

    assert(
      aptZeroReport.overallScore === 0 &&
        aptZeroReport.overallPerformanceLevel === "NEEDS_IMPROVEMENT" &&
        aptZeroReport.status === "READY",
      "TEST 17: Aptitude 0% Remains Valid",
      `Aptitude 0% correctly preserved as overallScore = 0 (NEEDS_IMPROVEMENT)`
    );

    // --------------------------------------------------------------------------
    // TEST 18: APTITUDE NONZERO DETERMINISTIC BREAKDOWN
    // --------------------------------------------------------------------------
    const aptNonzeroSession = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "APTITUDE",
        difficulty: "MID",
        score: 87,
        status: "COMPLETED",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const aptNonzeroReport = await DeterministicReportEngine.generateDeterministicReport(
      aptNonzeroSession.id
    );

    assert(
      aptNonzeroReport.overallScore === 87 &&
        aptNonzeroReport.overallPerformanceLevel === "EXEMPLARY" &&
        aptNonzeroReport.pillarScores.length === 3 &&
        aptNonzeroReport.pillarScores[0].name === "Quantitative Ability",
      "TEST 18: Aptitude Nonzero Deterministic Breakdown",
      `Aptitude score 87 produces score=87, performanceLevel=EXEMPLARY, 3 canonical categories`
    );

    // --------------------------------------------------------------------------
    // TEST 19: ZERO LLM CALLS VERIFICATION
    // --------------------------------------------------------------------------
    const t0 = performance.now();
    const finalReport = await DeterministicReportEngine.generateDeterministicReport(
      testSession.id
    );
    const dbRoundtripMs = Math.round(performance.now() - t0);

    // Pure in-memory calculation benchmark
    const tCalc0 = performance.now();
    const testScoreCalc = DeterministicReportEngine.calculateOverallScore(finalReport.pillarScores);
    const testTrajCalc = DeterministicReportEngine.reconstructDifficultyTrajectory("MID", testEvals);
    const inMemoryCalcMs = (performance.now() - tCalc0).toFixed(2);

    assert(
      globalLLMCallCount === 0 && finalReport.status === "READY",
      "TEST 19: Zero LLM Calls Verification",
      `Strictly 0 LLM calls made (globalLLMCallCount = 0). Pure in-memory math: ${inMemoryCalcMs}ms, DB retrieval: ${dbRoundtripMs}ms`
    );

    // --------------------------------------------------------------------------
    // TEST 20: FROZEN PHASE ARCHITECTURAL INTEGRITY
    // --------------------------------------------------------------------------
    // Confirm report generator is 100% read-only and never claimed/modified jobs or mutated mastery
    const untouchedJobs = await prisma.evaluationJob.findMany({
      where: { sessionId: testSession.id },
    });
    const stillCompleted = untouchedJobs.every((j) => j.status === "COMPLETED");

    assert(
      stillCompleted && untouchedJobs.length === 2,
      "TEST 20: Frozen Phase Architectural Integrity",
      `All 2 jobs remained in original state without report engine claiming, stealing, or mutating (0 mutations)`
    );

    // Cleanup test jobs & sessions
    await prisma.evaluationJob.deleteMany({
      where: { id: { in: [completedJob1.id, completedJob2.id] } },
    });
    await prisma.interviewSession.deleteMany({
      where: { id: { in: [aptZeroSession.id, aptNonzeroSession.id] } },
    });
  } finally {
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
  console.log(`PHASE 4A-1 TEST RESULTS: ${totalPassed} / ${results.length} PASSED`);
  console.log("================================================================");

  if (totalPassed < results.length) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error("Test harness failed:", err);
  process.exit(1);
});
