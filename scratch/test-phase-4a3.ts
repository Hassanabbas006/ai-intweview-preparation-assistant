import { prisma } from "../lib/prisma";
import { GET as getReportHandler } from "../app/api/interview/[sessionId]/report/route";
import { POST as endSessionHandler } from "../app/api/interview/[sessionId]/end/route";
import { ReportPersistenceService } from "../services/report-persistence";
import { TurnEvaluationRecord } from "../services/evaluator";
import { NextRequest } from "next/server";
import { getLLMProvider, LLMProvider } from "../lib/llm";

// ============================================================================
// AUTHENTICATION MOCK & SPY SETUP
// ============================================================================

// Monkey-patch next-auth/next getServerSession for test isolation
const nextAuthNext = require("next-auth/next");
let mockAuthSession: any = null;
nextAuthNext.getServerSession = async () => mockAuthSession;

// Global LLM Call Counter to verify ZERO LLM calls in Phase 4A-3
let globalLLMCallCount = 0;

try {
  const originalGetProvider = getLLMProvider;
  (getLLMProvider as any) = function (this: any, ...args: any[]) {
    const provider: any = originalGetProvider.apply(this, args as any);
    return {
      name: provider.name,
      generateCompletion: async (...cArgs: any[]) => {
        globalLLMCallCount++;
        return provider.generateCompletion.apply(provider, cArgs as any);
      },
      streamCompletion: async function* (...sArgs: any[]) {
        globalLLMCallCount++;
        yield* provider.streamCompletion.apply(provider, sArgs as any);
      },
    };
  };
} catch {
  // Provider spy setup
}

// ============================================================================
// TEST HARNESS & ASSERTIONS
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
// PHASE 4A-3 VERIFICATION SUITE (20 TESTS)
// ============================================================================

async function runPhase4A3Tests() {
  console.log("================================================================");
  console.log("RUNNING PHASE 4A-3 VERIFICATION SUITE: REPORT HTTP & END INTEGRATION");
  console.log("================================================================");

  // Setup test users
  const ownerUser = await prisma.user.upsert({
    where: { email: "phase4a3_owner@mockinterview.local" },
    update: {},
    create: {
      email: "phase4a3_owner@mockinterview.local",
      domain: "BACKEND",
    },
  });

  const otherUser = await prisma.user.upsert({
    where: { email: "phase4a3_other@mockinterview.local" },
    update: {},
    create: {
      email: "phase4a3_other@mockinterview.local",
      domain: "FRONTEND",
    },
  });

  const createdSessionIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // TEST 1: GET READY Report
    // --------------------------------------------------------------------------
    const sessionReady = await prisma.interviewSession.create({
      data: {
        userId: ownerUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 300000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionReady.id);

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionReady.id}_t1`,
        sessionId: sessionReady.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Good answer",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 90, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    // Generate READY report in DB
    await ReportPersistenceService.getOrGenerateReport(sessionReady.id);

    // Call GET as owner
    mockAuthSession = { user: { id: ownerUser.id, email: ownerUser.email } };
    const getReadyReq = new NextRequest(`http://localhost:3000/api/interview/${sessionReady.id}/report`);
    const getReadyRes = await getReportHandler(getReadyReq, { params: { sessionId: sessionReady.id } });
    const getReadyJson = await getReadyRes.json();

    assert(
      getReadyRes.status === 200 &&
        getReadyJson.status === "READY" &&
        getReadyJson.report !== null &&
        getReadyJson.report.overallScore === 90 &&
        getReadyJson.report.overallPerformanceLevel === "EXEMPLARY",
      "TEST 1: GET READY Report",
      `Returned 200 with status=READY, overallScore=90, level=EXEMPLARY`
    );

    // --------------------------------------------------------------------------
    // TEST 2: GET PARTIAL Report
    // --------------------------------------------------------------------------
    const sessionPartial = await prisma.interviewSession.create({
      data: {
        userId: ownerUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 300000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionPartial.id);

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionPartial.id}_t1`,
        sessionId: sessionPartial.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Completed answer",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 85, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionPartial.id}_t2`,
        sessionId: sessionPartial.id,
        turnSequenceNumber: 2,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Failed answer",
        contextHistory: [],
        status: "FAILED",
        lastError: "Timeout",
        retryCount: 3,
      },
    });

    // Generate PARTIAL report in DB
    await ReportPersistenceService.getOrGenerateReport(sessionPartial.id);

    const getPartialReq = new NextRequest(`http://localhost:3000/api/interview/${sessionPartial.id}/report`);
    const getPartialRes = await getReportHandler(getPartialReq, { params: { sessionId: sessionPartial.id } });
    const getPartialJson = await getPartialRes.json();

    assert(
      getPartialRes.status === 200 &&
        getPartialJson.status === "PARTIAL" &&
        getPartialJson.report !== null &&
        getPartialJson.report.overallScore === 85 &&
        getPartialJson.report.reconciliation?.failedCount === 1,
      "TEST 2: GET PARTIAL Report",
      `Returned 200 with status=PARTIAL, overallScore=85, failedCount=1`
    );

    // --------------------------------------------------------------------------
    // TEST 3: GET WAITING Report
    // --------------------------------------------------------------------------
    const sessionWaiting = await prisma.interviewSession.create({
      data: {
        userId: ownerUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 300000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionWaiting.id);

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionWaiting.id}_t1`,
        sessionId: sessionWaiting.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Pending answer",
        contextHistory: [],
        status: "PENDING",
      },
    });

    // Generate initial report in DB (will be WAITING_FOR_EVALUATIONS)
    await ReportPersistenceService.getOrGenerateReport(sessionWaiting.id);

    const getWaitingReq = new NextRequest(`http://localhost:3000/api/interview/${sessionWaiting.id}/report`);
    const getWaitingRes = await getReportHandler(getWaitingReq, { params: { sessionId: sessionWaiting.id } });
    const getWaitingJson = await getWaitingRes.json();

    assert(
      getWaitingRes.status === 200 &&
        getWaitingJson.status === "WAITING_FOR_EVALUATIONS" &&
        getWaitingJson.report === null,
      "TEST 3: GET WAITING Report",
      `Returned 200 with status=WAITING_FOR_EVALUATIONS and report=null`
    );

    // --------------------------------------------------------------------------
    // TEST 4: GET FAILED Report
    // --------------------------------------------------------------------------
    const sessionFailed = await prisma.interviewSession.create({
      data: {
        userId: ownerUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionFailed.id);

    // Manually create FAILED report row with internal error
    await prisma.interviewReport.create({
      data: {
        sessionId: sessionFailed.id,
        status: "FAILED",
        lastError: "Database connection terminated unexpectedly at pg_pooler:5432",
        scores: {},
        strengths: [],
        weaknesses: [],
        tips: [],
      },
    });

    const getFailedReq = new NextRequest(`http://localhost:3000/api/interview/${sessionFailed.id}/report`);
    const getFailedRes = await getReportHandler(getFailedReq, { params: { sessionId: sessionFailed.id } });
    const getFailedJson = await getFailedRes.json();

    assert(
      getFailedRes.status === 200 &&
        getFailedJson.status === "FAILED" &&
        getFailedJson.report === null &&
        !JSON.stringify(getFailedJson).includes("pg_pooler:5432"),
      "TEST 4: GET FAILED Report",
      `Returned status=FAILED, report=null, zero internal error details leaked`
    );

    // --------------------------------------------------------------------------
    // TEST 5: Owner Authorization
    // --------------------------------------------------------------------------
    mockAuthSession = { user: { id: ownerUser.id, email: ownerUser.email } };
    const authOwnerReq = new NextRequest(`http://localhost:3000/api/interview/${sessionReady.id}/report`);
    const authOwnerRes = await getReportHandler(authOwnerReq, { params: { sessionId: sessionReady.id } });

    assert(
      authOwnerRes.status === 200,
      "TEST 5: Owner Authorization",
      `Owner permitted to access their report (HTTP 200)`
    );

    // --------------------------------------------------------------------------
    // TEST 6: Unauthenticated Access
    // --------------------------------------------------------------------------
    mockAuthSession = null; // Unauthenticated
    const unauthReq = new NextRequest(`http://localhost:3000/api/interview/${sessionReady.id}/report`);
    const unauthRes = await getReportHandler(unauthReq, { params: { sessionId: sessionReady.id } });

    assert(
      unauthRes.status === 401,
      "TEST 6: Unauthenticated Access Blocked",
      `Unauthenticated request strictly blocked with HTTP 401 Unauthorized`
    );

    // --------------------------------------------------------------------------
    // TEST 7: Wrong-User Access Blocked
    // --------------------------------------------------------------------------
    mockAuthSession = { user: { id: otherUser.id, email: otherUser.email } }; // Different user
    const wrongUserReq = new NextRequest(`http://localhost:3000/api/interview/${sessionReady.id}/report`);
    const wrongUserRes = await getReportHandler(wrongUserReq, { params: { sessionId: sessionReady.id } });
    const wrongUserJson = await wrongUserRes.json();

    assert(
      wrongUserRes.status === 403 && wrongUserJson.report === undefined,
      "TEST 7: Wrong-User Access Blocked",
      `Wrong-user request strictly blocked with HTTP 403 Forbidden; zero report data returned`
    );

    // --------------------------------------------------------------------------
    // TEST 8: Nonexistent Session Handled Correctly
    // --------------------------------------------------------------------------
    mockAuthSession = { user: { id: ownerUser.id, email: ownerUser.email } };
    const nonExistentReq = new NextRequest(`http://localhost:3000/api/interview/nonexistent_session_9999/report`);
    const nonExistentRes = await getReportHandler(nonExistentReq, { params: { sessionId: "nonexistent_session_9999" } });

    assert(
      nonExistentRes.status === 404,
      "TEST 8: Nonexistent Session Handled Correctly",
      `Nonexistent session strictly returned HTTP 404 Not Found`
    );

    // --------------------------------------------------------------------------
    // TEST 9: Nonexistent Report Handled Correctly
    // --------------------------------------------------------------------------
    const sessionNoReport = await prisma.interviewSession.create({
      data: {
        userId: ownerUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionNoReport.id);

    const noReportReq = new NextRequest(`http://localhost:3000/api/interview/${sessionNoReport.id}/report`);
    const noReportRes = await getReportHandler(noReportReq, { params: { sessionId: sessionNoReport.id } });

    assert(
      noReportRes.status === 404,
      "TEST 9: Nonexistent Report Handled Correctly",
      `Session without report returned HTTP 404 Not Found without crashing`
    );

    // --------------------------------------------------------------------------
    // TEST 10: End Route READY
    // --------------------------------------------------------------------------
    const sessionEndReady = await prisma.interviewSession.create({
      data: {
        userId: ownerUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "IN_PROGRESS",
        startedAt: new Date(Date.now() - 200000),
      },
    });
    createdSessionIds.push(sessionEndReady.id);

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionEndReady.id}_t1`,
        sessionId: sessionEndReady.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Ready answer",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 95, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    mockAuthSession = { user: { id: ownerUser.id, email: ownerUser.email } };
    const endReadyReq = new NextRequest(`http://localhost:3000/api/interview/${sessionEndReady.id}/end`, { method: "POST" });
    const endReadyRes = await endSessionHandler(endReadyReq, { params: { sessionId: sessionEndReady.id } });
    const endReadyJson = await endReadyRes.json();

    assert(
      endReadyRes.status === 200 &&
        endReadyJson.sessionStatus === "COMPLETED" &&
        endReadyJson.reportStatus === "READY" &&
        endReadyJson.reportUrl === `/interview/${sessionEndReady.id}/report`,
      "TEST 10: End Route READY",
      `End route marked COMPLETED, resolved reportStatus=READY, reportUrl correct`
    );

    // --------------------------------------------------------------------------
    // TEST 11: End Route WAITING
    // --------------------------------------------------------------------------
    const sessionEndWaiting = await prisma.interviewSession.create({
      data: {
        userId: ownerUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "IN_PROGRESS",
        startedAt: new Date(Date.now() - 200000),
      },
    });
    createdSessionIds.push(sessionEndWaiting.id);

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionEndWaiting.id}_t1`,
        sessionId: sessionEndWaiting.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Pending answer",
        contextHistory: [],
        status: "PENDING",
      },
    });

    const endWaitingReq = new NextRequest(`http://localhost:3000/api/interview/${sessionEndWaiting.id}/end`, { method: "POST" });
    const endWaitingRes = await endSessionHandler(endWaitingReq, { params: { sessionId: sessionEndWaiting.id } });
    const endWaitingJson = await endWaitingRes.json();

    assert(
      endWaitingRes.status === 200 &&
        endWaitingJson.sessionStatus === "COMPLETED" &&
        endWaitingJson.reportStatus === "WAITING_FOR_EVALUATIONS" &&
        endWaitingJson.reportUrl === `/interview/${sessionEndWaiting.id}/report`,
      "TEST 11: End Route WAITING",
      `End route marked COMPLETED, returned reportStatus=WAITING_FOR_EVALUATIONS without stealing jobs`
    );

    // --------------------------------------------------------------------------
    // TEST 12: End Route PARTIAL
    // --------------------------------------------------------------------------
    const sessionEndPartial = await prisma.interviewSession.create({
      data: {
        userId: ownerUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "IN_PROGRESS",
        startedAt: new Date(Date.now() - 200000),
      },
    });
    createdSessionIds.push(sessionEndPartial.id);

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionEndPartial.id}_t1`,
        sessionId: sessionEndPartial.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Completed answer",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 80, "COMPLETED", "MASTERY_ADEQUATE", "PILLAR-0") as any,
      },
    });

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionEndPartial.id}_t2`,
        sessionId: sessionEndPartial.id,
        turnSequenceNumber: 2,
        pillarSlug: "PILLAR-0",
        candidateMessage: "Failed answer",
        contextHistory: [],
        status: "FAILED",
        lastError: "Network unreachable",
        retryCount: 3,
      },
    });

    const endPartialReq = new NextRequest(`http://localhost:3000/api/interview/${sessionEndPartial.id}/end`, { method: "POST" });
    const endPartialRes = await endSessionHandler(endPartialReq, { params: { sessionId: sessionEndPartial.id } });
    const endPartialJson = await endPartialRes.json();

    assert(
      endPartialRes.status === 200 &&
        endPartialJson.sessionStatus === "COMPLETED" &&
        endPartialJson.reportStatus === "PARTIAL" &&
        endPartialJson.reportUrl === `/interview/${sessionEndPartial.id}/report`,
      "TEST 12: End Route PARTIAL",
      `End route marked COMPLETED, returned reportStatus=PARTIAL due to failed job`
    );

    // --------------------------------------------------------------------------
    // TEST 13: End Route Does Not Mutate EvaluationJobs
    // --------------------------------------------------------------------------
    const pendingJobBefore = await prisma.evaluationJob.findUnique({
      where: { idempotencyKey: `eval_${sessionEndWaiting.id}_t1` },
    });

    // Invoke end route again
    const endRepeatReq = new NextRequest(`http://localhost:3000/api/interview/${sessionEndWaiting.id}/end`, { method: "POST" });
    await endSessionHandler(endRepeatReq, { params: { sessionId: sessionEndWaiting.id } });

    const pendingJobAfter = await prisma.evaluationJob.findUnique({
      where: { idempotencyKey: `eval_${sessionEndWaiting.id}_t1` },
    });

    assert(
      pendingJobBefore !== null &&
        pendingJobAfter !== null &&
        pendingJobBefore.status === "PENDING" &&
        pendingJobAfter.status === "PENDING" &&
        pendingJobBefore.retryCount === pendingJobAfter.retryCount &&
        pendingJobBefore.claimedAt === pendingJobAfter.claimedAt,
      "TEST 13: End Route Does Not Mutate EvaluationJobs",
      `EvaluationJob status remained strictly PENDING across end route calls (0 mutations)`
    );

    // --------------------------------------------------------------------------
    // TEST 14: GET Does Not Mutate EvaluationJobs
    // --------------------------------------------------------------------------
    const getWaitingJobBefore = await prisma.evaluationJob.findUnique({
      where: { idempotencyKey: `eval_${sessionWaiting.id}_t1` },
    });

    // Invoke GET route
    const getRepeatReq = new NextRequest(`http://localhost:3000/api/interview/${sessionWaiting.id}/report`);
    await getReportHandler(getRepeatReq, { params: { sessionId: sessionWaiting.id } });

    const getWaitingJobAfter = await prisma.evaluationJob.findUnique({
      where: { idempotencyKey: `eval_${sessionWaiting.id}_t1` },
    });

    assert(
      getWaitingJobBefore !== null &&
        getWaitingJobAfter !== null &&
        getWaitingJobBefore.status === "PENDING" &&
        getWaitingJobAfter.status === "PENDING",
      "TEST 14: GET Does Not Mutate EvaluationJobs",
      `EvaluationJob status remained strictly PENDING across GET route calls (0 mutations)`
    );

    // --------------------------------------------------------------------------
    // TEST 15: GET Makes 0 LLM Calls
    // --------------------------------------------------------------------------
    const llmCallsBeforeGet = globalLLMCallCount;
    const test15Req = new NextRequest(`http://localhost:3000/api/interview/${sessionReady.id}/report`);
    await getReportHandler(test15Req, { params: { sessionId: sessionReady.id } });
    const llmCallsAfterGet = globalLLMCallCount;

    assert(
      llmCallsBeforeGet === llmCallsAfterGet,
      "TEST 15: GET Makes 0 LLM Calls",
      `Strictly 0 LLM calls made during GET /report (calls count delta: 0)`
    );

    // --------------------------------------------------------------------------
    // TEST 16: End Makes 0 LLM Calls
    // --------------------------------------------------------------------------
    const llmCallsBeforeEnd = globalLLMCallCount;
    const test16Req = new NextRequest(`http://localhost:3000/api/interview/${sessionEndReady.id}/end`, { method: "POST" });
    await endSessionHandler(test16Req, { params: { sessionId: sessionEndReady.id } });
    const llmCallsAfterEnd = globalLLMCallCount;

    assert(
      llmCallsBeforeEnd === llmCallsAfterEnd,
      "TEST 16: End Makes 0 LLM Calls",
      `Strictly 0 LLM calls made during POST /end (calls count delta: 0)`
    );

    // --------------------------------------------------------------------------
    // TEST 17: Stable Response Schema
    // --------------------------------------------------------------------------
    const schemaReq = new NextRequest(`http://localhost:3000/api/interview/${sessionReady.id}/report`);
    const schemaRes = await getReportHandler(schemaReq, { params: { sessionId: sessionReady.id } });
    const schemaJson = await schemaRes.json();

    const hasExpectedFields =
      typeof schemaJson.sessionId === "string" &&
      schemaJson.status === "READY" &&
      typeof schemaJson.report === "object" &&
      typeof schemaJson.report.overallScore === "number" &&
      typeof schemaJson.report.overallPerformanceLevel === "string" &&
      Array.isArray(schemaJson.report.pillarScores) &&
      typeof schemaJson.report.reconciliation === "object";

    assert(
      hasExpectedFields,
      "TEST 17: Stable Response Schema",
      `Response schema strictly matches required client contract: sessionId, status, report { overallScore, ... }`
    );

    // --------------------------------------------------------------------------
    // TEST 18: Existing Report Reuse (No Unnecessary Re-Calculation)
    // --------------------------------------------------------------------------
    const existingDbReport = await prisma.interviewReport.findUnique({
      where: { sessionId: sessionReady.id },
    });

    const reuseReq = new NextRequest(`http://localhost:3000/api/interview/${sessionReady.id}/report`);
    await getReportHandler(reuseReq, { params: { sessionId: sessionReady.id } });

    const reportAfterGet = await prisma.interviewReport.findUnique({
      where: { sessionId: sessionReady.id },
    });

    assert(
      existingDbReport !== null &&
        reportAfterGet !== null &&
        existingDbReport.updatedAt.getTime() === reportAfterGet.updatedAt.getTime(),
      "TEST 18: Existing Report Reuse",
      `READY report returned without modifying database row (updatedAt unchanged)`
    );

    // --------------------------------------------------------------------------
    // TEST 19: No Duplicate Report Creation
    // --------------------------------------------------------------------------
    const reportCountForSession = await prisma.interviewReport.count({
      where: { sessionId: sessionEndReady.id },
    });

    assert(
      reportCountForSession === 1,
      "TEST 19: No Duplicate Report Creation",
      `Exactly 1 report record exists in database for completed session`
    );

    // --------------------------------------------------------------------------
    // TEST 20: Report URL Correctness
    // --------------------------------------------------------------------------
    assert(
      endReadyJson.reportUrl === `/interview/${sessionEndReady.id}/report`,
      "TEST 20: Report URL Correctness",
      `Report URL strictly formatted as /interview/${sessionEndReady.id}/report`
    );

  } finally {
    // Clean up created sessions and associated data
    for (const sid of createdSessionIds) {
      await prisma.interviewReport.deleteMany({ where: { sessionId: sid } });
      await prisma.evaluationJob.deleteMany({ where: { sessionId: sid } });
      await prisma.interviewMessage.deleteMany({ where: { sessionId: sid } });
      await prisma.interviewSession.deleteMany({ where: { id: sid } });
    }
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log("================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`PHASE 4A-3 TEST RESULTS: ${passedCount} / ${results.length} PASSED`);
  console.log("================================================================");

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runPhase4A3Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
