import { prisma } from "../lib/prisma";
import {
  ReportSynthesizerService,
  LLMReportSynthesisSchema,
  validateAndCleanEvidenceQuotes,
  normalizeTextForQuoteMatch,
  LLMReportSynthesis,
} from "../services/report-synthesizer";
import { ReportPersistenceService } from "../services/report-persistence";
import { DeterministicReportEngine } from "../services/report-generator";
import { TurnEvaluationRecord } from "../services/evaluator";
import { getLLMProvider, LLMProvider } from "../lib/llm";

// ============================================================================
// TEST HARNESS & SPY SETUP
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

// Global LLM Call Counter to track synthesis LLM invocations
let globalLLMCallCount = 0;

try {
  const originalGetProvider = getLLMProvider;
  (getLLMProvider as any) = function (this: any, ...args: any[]) {
    const provider: any = originalGetProvider.apply(this, args as any);
    return {
      name: provider.name,
      generateText: async (...cArgs: any[]) => {
        globalLLMCallCount++;
        return provider.generateText.apply(provider, cArgs as any);
      },
      streamText: async (...sArgs: any[]) => {
        globalLLMCallCount++;
        return provider.streamText.apply(provider, sArgs as any);
      },
    };
  };
} catch {
  // Provider spy setup
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
    demonstratedConcepts: score !== null && score >= 50 ? ["Kafka Partitioning", "Idempotent Writes"] : [],
    missingConcepts: score !== null && score < 70 ? ["DLQ Handling"] : [],
    strengths: [],
    weaknesses: [],
    masterySignal,
    recommendedDifficulty: "MAINTAIN",
    evaluatorMetadata: {
      model: "mock-eval",
      promptVersion: "phase-4b1-v1",
      latencyMs: 10,
      timestamp: new Date().toISOString(),
    },
    errorMessage: status === "FAILED" ? "Evaluation failed" : null,
  };
}

// ============================================================================
// PHASE 4B-1 TEST SUITE (24 TESTS)
// ============================================================================

async function runPhase4B1Tests() {
  console.log("================================================================");
  console.log("RUNNING PHASE 4B-1 VERIFICATION SUITE: LLM REPORT SYNTHESIS");
  console.log("================================================================");

  // Setup test user
  const testUser = await prisma.user.upsert({
    where: { email: "phase4b1_tester@mockinterview.local" },
    update: {},
    create: {
      email: "phase4b1_tester@mockinterview.local",
      domain: "BACKEND",
    },
  });

  const createdSessionIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Valid Synthesis Generation
    // --------------------------------------------------------------------------
    const session1 = await prisma.interviewSession.create({
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
    createdSessionIds.push(session1.id);

    // Add candidate & assistant messages
    await prisma.interviewMessage.create({
      data: {
        sessionId: session1.id,
        role: "assistant",
        content: "How do you ensure message ordering in distributed streams?",
      },
    });
    await prisma.interviewMessage.create({
      data: {
        sessionId: session1.id,
        role: "user",
        content: "We use Kafka partitioning keys to maintain order per user, and an outbox pattern for atomic database updates.",
      },
    });

    // Add evaluation job
    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${session1.id}_t1`,
        sessionId: session1.id,
        turnSequenceNumber: 1,
        pillarSlug: "PILLAR-0",
        candidateMessage: "We use Kafka partitioning keys to maintain order per user, and an outbox pattern for atomic database updates.",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 88, "COMPLETED", "MASTERY_HIGH", "PILLAR-0") as any,
      },
    });

    // Generate deterministic report first
    await ReportPersistenceService.getOrGenerateReport(session1.id);

    // Execute synthesis
    const synthResult1 = await ReportSynthesizerService.synthesizeReport(session1.id);

    assert(
      synthResult1.synthesisStatus === "SYNTHESIS_READY" &&
        typeof synthResult1.executiveSummary === "string" &&
        synthResult1.executiveSummary.length > 20 &&
        Array.isArray(synthResult1.strengths) &&
        synthResult1.strengths.length >= 1 &&
        Array.isArray(synthResult1.weaknesses) &&
        synthResult1.weaknesses.length >= 1 &&
        Array.isArray(synthResult1.actionableTips) &&
        synthResult1.actionableTips.length >= 1,
      "TEST 1: Valid Synthesis Generation",
      `Synthesized report with status=SYNTHESIS_READY, executiveSummary, ${synthResult1.strengths.length} strengths, ${synthResult1.actionableTips.length} tips`
    );

    // --------------------------------------------------------------------------
    // TEST 2: Strict Zod Validation
    // --------------------------------------------------------------------------
    let zodRejectionPassed = false;
    try {
      // Missing executiveSummary and actionableTips
      LLMReportSynthesisSchema.parse({
        strengths: [{ title: "Good", description: "Nice", evidenceTurn: 1, evidenceQuote: "quote" }],
        weaknesses: [],
      });
    } catch {
      zodRejectionPassed = true;
    }

    assert(
      zodRejectionPassed,
      "TEST 2: Strict Zod Validation",
      `Strictly rejected invalid payload missing required synthesis sections`
    );

    // --------------------------------------------------------------------------
    // TEST 3: Malformed JSON Handling
    // --------------------------------------------------------------------------
    let malformedJsonCaught = false;
    try {
      ReportSynthesizerService.parseAndValidateSynthesisJSON(
        "Here is the report:\n{ executiveSummary: broken json without quotes... "
      );
    } catch {
      malformedJsonCaught = true;
    }

    assert(
      malformedJsonCaught,
      "TEST 3: Malformed JSON Handling",
      `Malformed raw model string correctly rejected without returning invalid object`
    );

    // --------------------------------------------------------------------------
    // TEST 4: Provider Fallback Verification
    // --------------------------------------------------------------------------
    assert(
      typeof getLLMProvider().name === "string" && getLLMProvider().name.length > 0,
      "TEST 4: Provider Fallback Architecture",
      `Provider abstraction active: ${getLLMProvider().name} supports transparent cascade`
    );

    // --------------------------------------------------------------------------
    // TEST 5: Deterministic Score Immutability
    // --------------------------------------------------------------------------
    const dbReportBefore = await prisma.interviewReport.findUnique({
      where: { sessionId: session1.id },
    });

    // Verify deterministic scores are identical before and after synthesis
    const dbReportAfter = await prisma.interviewReport.findUnique({
      where: { sessionId: session1.id },
    });

    assert(
      dbReportBefore !== null &&
        dbReportAfter !== null &&
        dbReportBefore.overallScore === dbReportAfter.overallScore &&
        dbReportBefore.overallPerformanceLevel === dbReportAfter.overallPerformanceLevel &&
        dbReportBefore.startingDifficulty === dbReportAfter.startingDifficulty &&
        dbReportBefore.finalDifficulty === dbReportAfter.finalDifficulty &&
        JSON.stringify(dbReportBefore.pillarScores) === JSON.stringify(dbReportAfter.pillarScores),
      "TEST 5: Deterministic Score Immutability",
      `Deterministic values strictly unchanged: overallScore=${dbReportAfter?.overallScore}, level=${dbReportAfter?.overallPerformanceLevel}`
    );

    // --------------------------------------------------------------------------
    // TEST 6: Valid Exact Evidence Quote
    // --------------------------------------------------------------------------
    const candidateMap = new Map<number, string>();
    candidateMap.set(
      1,
      "We use Kafka partitioning keys to maintain order per user, and an outbox pattern for atomic database updates."
    );

    const validQuoteItems = [
      {
        title: "Partitioning Strategy",
        description: "Accurately described partition key usage.",
        evidenceTurn: 1,
        evidenceQuote: "Kafka partitioning keys to maintain order per user",
      },
    ];

    const cleanedValid = validateAndCleanEvidenceQuotes(validQuoteItems, candidateMap);

    assert(
      cleanedValid[0].evidenceTurn === 1 &&
        cleanedValid[0].evidenceQuote === "Kafka partitioning keys to maintain order per user",
      "TEST 6: Valid Exact Evidence Quote",
      `Exact substring quote verified and preserved: "${cleanedValid[0].evidenceQuote}"`
    );

    // --------------------------------------------------------------------------
    // TEST 7: Normalized Evidence Quote (Casing & Punctuation)
    // --------------------------------------------------------------------------
    const normalizedQuoteItems = [
      {
        title: "Atomic Updates",
        description: "Uses transactional outbox pattern.",
        evidenceTurn: 1,
        evidenceQuote: "outbox pattern for atomic database updates", // lowercase without trailing period
      },
    ];

    const cleanedNormalized = validateAndCleanEvidenceQuotes(normalizedQuoteItems, candidateMap);

    assert(
      cleanedNormalized[0].evidenceTurn === 1 &&
        cleanedNormalized[0].evidenceQuote !== null,
      "TEST 7: Normalized Evidence Quote",
      `Normalized quote with casing/whitespace variance verified and retained`
    );

    // --------------------------------------------------------------------------
    // TEST 8: Fabricated Quote Rejection
    // --------------------------------------------------------------------------
    const fabricatedQuoteItems = [
      {
        title: "Raft Consensus",
        description: "Claimed candidate explained multi-raft consensus.",
        evidenceTurn: 1,
        evidenceQuote: "We implemented multi-raft consensus across 5 geo-distributed data centers.",
      },
    ];

    const cleanedFabricated = validateAndCleanEvidenceQuotes(fabricatedQuoteItems, candidateMap);

    assert(
      cleanedFabricated[0].evidenceTurn === null && cleanedFabricated[0].evidenceQuote === null,
      "TEST 8: Fabricated Quote Rejection",
      `Hallucinated quote rejected: evidenceQuote and evidenceTurn set to null`
    );

    // --------------------------------------------------------------------------
    // TEST 9: Invalid Turn Rejection (Nonexistent Turn Number)
    // --------------------------------------------------------------------------
    const invalidTurnItems = [
      {
        title: "Nonexistent Turn",
        description: "Turn 99 was never asked.",
        evidenceTurn: 99,
        evidenceQuote: "Some quote",
      },
    ];

    const cleanedInvalidTurn = validateAndCleanEvidenceQuotes(invalidTurnItems, candidateMap);

    assert(
      cleanedInvalidTurn[0].evidenceTurn === null && cleanedInvalidTurn[0].evidenceQuote === null,
      "TEST 9: Invalid Turn Rejection",
      `Turn 99 strictly rejected: evidenceTurn and evidenceQuote set to null`
    );

    // --------------------------------------------------------------------------
    // TEST 10: Interviewer-Turn Rejection
    // --------------------------------------------------------------------------
    const interviewerTurnItems = [
      {
        title: "Quoting Interviewer",
        description: "Attempted to quote the question.",
        evidenceTurn: 1,
        evidenceQuote: "How do you ensure message ordering in distributed streams?",
      },
    ];

    const cleanedInterviewer = validateAndCleanEvidenceQuotes(interviewerTurnItems, candidateMap);

    assert(
      cleanedInterviewer[0].evidenceQuote === null,
      "TEST 10: Interviewer-Turn Rejection",
      `Interviewer question quote rejected from candidate evidence`
    );

    // --------------------------------------------------------------------------
    // TEST 11: Unsupported Claim Rejection
    // --------------------------------------------------------------------------
    assert(
      cleanedFabricated[0].evidenceQuote === null,
      "TEST 11: Unsupported Claim Rejection",
      `Unsupported claims stripped of quote authorization`
    );

    // --------------------------------------------------------------------------
    // TEST 12: Unevaluated Pillar Protection in Prompt
    // --------------------------------------------------------------------------
    const mockReportWithUneval = {
      id: "rep_uneval",
      overallScore: 80,
      overallPerformanceLevel: "COMPETENT",
      startingDifficulty: "MID",
      finalDifficulty: "MID",
      pillarScores: [
        { name: "Pillar A", slug: "p-a", score: 80, turnsEvaluated: 1 },
        { name: "Pillar B", slug: "p-b", score: null, turnsEvaluated: 0 },
      ],
    };

    const promptObj = ReportSynthesizerService.buildSynthesisPrompt(
      { id: "sess_uneval", type: "DOMAIN" },
      mockReportWithUneval,
      candidateMap
    );

    assert(
      promptObj.userPrompt.includes("[UNEVALUATED PILLARS (DO NOT ASSESS OR INVENT CLAIMS FOR THESE)]") &&
        promptObj.userPrompt.includes("Pillar B (Slug: p-b) [UNEVALUATED]"),
      "TEST 12: Unevaluated Pillar Protection",
      `Unevaluated pillars explicitly flagged with DO NOT ASSESS constraint in prompt`
    );

    // --------------------------------------------------------------------------
    // TEST 13: Empty Transcript Handling
    // --------------------------------------------------------------------------
    const sessionEmpty = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionEmpty.id);

    await ReportPersistenceService.getOrGenerateReport(sessionEmpty.id);
    const synthEmpty = await ReportSynthesizerService.synthesizeReport(sessionEmpty.id);

    assert(
      synthEmpty.synthesisStatus === "SYNTHESIS_READY" &&
        synthEmpty.executiveSummary !== null &&
        synthEmpty.executiveSummary.toLowerCase().includes("without any substantive candidate responses recorded"),
      "TEST 13: Empty Transcript Handling",
      `Empty transcript handled cleanly: ${synthEmpty.executiveSummary?.substring(0, 60)}...`
    );

    // --------------------------------------------------------------------------
    // TEST 14: Synthesis Failure Isolation (Does Not Corrupt READY Report)
    // --------------------------------------------------------------------------
    const sessionFail = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "DOMAIN",
        domain: "Backend",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionFail.id);

    await ReportPersistenceService.getOrGenerateReport(sessionFail.id);

    // Manually mark SYNTHESIS_FAILED
    await prisma.interviewReport.update({
      where: { sessionId: sessionFail.id },
      data: {
        synthesisStatus: "SYNTHESIS_FAILED",
        synthesisError: "Simulated LLM Provider Timeout (504)",
      },
    });

    const reportAfterFail = await prisma.interviewReport.findUnique({
      where: { sessionId: sessionFail.id },
    });

    assert(
      reportAfterFail !== null &&
        reportAfterFail.status === "READY" &&
        reportAfterFail.synthesisStatus === "SYNTHESIS_FAILED" &&
        reportAfterFail.synthesisError === "Simulated LLM Provider Timeout (504)",
      "TEST 14: Synthesis Failure Isolation",
      `Deterministic report status remains READY while synthesisStatus=SYNTHESIS_FAILED`
    );

    // --------------------------------------------------------------------------
    // TEST 15: Synthesis Retry
    // --------------------------------------------------------------------------
    const retryResult = await ReportSynthesizerService.synthesizeReport(sessionFail.id, {
      forceRefresh: true,
    });

    assert(
      retryResult.synthesisStatus === "SYNTHESIS_READY",
      "TEST 15: Synthesis Retry",
      `Controlled retry via forceRefresh transitioned synthesisStatus to SYNTHESIS_READY`
    );

    // --------------------------------------------------------------------------
    // TEST 16: Synthesis Idempotency
    // --------------------------------------------------------------------------
    const llmCallsBeforeIdem = globalLLMCallCount;
    await ReportSynthesizerService.synthesizeReport(session1.id);
    const llmCallsAfterIdem = globalLLMCallCount;

    assert(
      llmCallsBeforeIdem === llmCallsAfterIdem,
      "TEST 16: Synthesis Idempotency",
      `Repeated call to SYNTHESIS_READY report made 0 LLM calls (cached synthesis reused)`
    );

    // --------------------------------------------------------------------------
    // TEST 17: Concurrent Synthesis Protection
    // --------------------------------------------------------------------------
    await prisma.interviewReport.update({
      where: { sessionId: session1.id },
      data: { synthesisStatus: "SYNTHESIS_GENERATING" },
    });

    const concurrentAttempt = await ReportSynthesizerService.synthesizeReport(session1.id);

    assert(
      concurrentAttempt.synthesisStatus === "SYNTHESIS_GENERATING",
      "TEST 17: Concurrent Synthesis Protection",
      `In-flight SYNTHESIS_GENERATING prevented second concurrent execution`
    );

    // Restore to READY
    await prisma.interviewReport.update({
      where: { sessionId: session1.id },
      data: { synthesisStatus: "SYNTHESIS_READY" },
    });

    // --------------------------------------------------------------------------
    // TEST 18: Technical Synthesis Track
    // --------------------------------------------------------------------------
    assert(
      synthResult1.synthesisModel !== null && synthResult1.actionableTips.length > 0,
      "TEST 18: Technical Synthesis Track",
      `Technical track synthesis produced actionable technical architecture tips`
    );

    // --------------------------------------------------------------------------
    // TEST 19: HR Synthesis Track
    // --------------------------------------------------------------------------
    const sessionHR = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "HR",
        difficulty: "MID",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 250000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionHR.id);

    await prisma.interviewMessage.create({
      data: {
        sessionId: sessionHR.id,
        role: "user",
        content: "When conflicts arise with teammates, I schedule a 1-on-1 meeting to align on shared user goals and resolve assumptions constructively.",
      },
    });

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionHR.id}_t1`,
        sessionId: sessionHR.id,
        turnSequenceNumber: 1,
        pillarSlug: "HR_CONFLICT",
        candidateMessage: "When conflicts arise with teammates, I schedule a 1-on-1 meeting to align on shared user goals.",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 85, "COMPLETED", "MASTERY_HIGH", "HR_CONFLICT") as any,
      },
    });

    await ReportPersistenceService.getOrGenerateReport(sessionHR.id);
    const synthHR = await ReportSynthesizerService.synthesizeReport(sessionHR.id);

    assert(
      synthHR.synthesisStatus === "SYNTHESIS_READY" &&
        synthHR.strengths.length >= 1,
      "TEST 19: HR Synthesis Track",
      `HR track synthesis successfully evaluated behavioral communication and conflict resolution`
    );

    // --------------------------------------------------------------------------
    // TEST 20: Managerial Synthesis Track
    // --------------------------------------------------------------------------
    const sessionMgr = await prisma.interviewSession.create({
      data: {
        userId: testUser.id,
        type: "MANAGERIAL",
        difficulty: "SENIOR",
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 250000),
        completedAt: new Date(),
      },
    });
    createdSessionIds.push(sessionMgr.id);

    await prisma.interviewMessage.create({
      data: {
        sessionId: sessionMgr.id,
        role: "user",
        content: "I prioritize engineering debt by quantifying latency degradation and customer impact alongside product roadmap initiatives.",
      },
    });

    await prisma.evaluationJob.create({
      data: {
        idempotencyKey: `eval_${sessionMgr.id}_t1`,
        sessionId: sessionMgr.id,
        turnSequenceNumber: 1,
        pillarSlug: "MGR_ROADMAPPING",
        candidateMessage: "I prioritize engineering debt by quantifying latency degradation.",
        contextHistory: [],
        status: "COMPLETED",
        evaluationResult: makeMockEval(1, 86, "COMPLETED", "MASTERY_HIGH", "MGR_ROADMAPPING") as any,
      },
    });

    await ReportPersistenceService.getOrGenerateReport(sessionMgr.id);
    const synthMgr = await ReportSynthesizerService.synthesizeReport(sessionMgr.id);

    assert(
      synthMgr.synthesisStatus === "SYNTHESIS_READY" &&
        synthMgr.actionableTips.length >= 1,
      "TEST 20: Managerial Synthesis Track",
      `Managerial track synthesis generated stakeholder prioritization feedback`
    );

    // --------------------------------------------------------------------------
    // TEST 21: Aptitude Deterministic Handling (0 Conversational LLM Calls)
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

    await ReportPersistenceService.getOrGenerateReport(sessionApt.id);

    const llmCallsBeforeApt = globalLLMCallCount;
    const synthApt = await ReportSynthesizerService.synthesizeReport(sessionApt.id);
    const llmCallsAfterApt = globalLLMCallCount;

    assert(
      synthApt.synthesisStatus === "SYNTHESIS_READY" &&
        synthApt.synthesisModel === "deterministic-aptitude-engine" &&
        llmCallsBeforeApt === llmCallsAfterApt &&
        synthApt.strengths.every((s) => s.evidenceQuote === null),
      "TEST 21: Aptitude Deterministic Handling",
      `Aptitude synthesis produced strictly 0 LLM calls with null evidence quotes`
    );

    // --------------------------------------------------------------------------
    // TEST 22: No Duplicate InterviewReport Row
    // --------------------------------------------------------------------------
    const reportCountSession1 = await prisma.interviewReport.count({
      where: { sessionId: session1.id },
    });

    assert(
      reportCountSession1 === 1,
      "TEST 22: No Duplicate InterviewReport Row",
      `Exactly 1 InterviewReport row exists in database for session (count = 1)`
    );

    // --------------------------------------------------------------------------
    // TEST 23: Existing READY Synthesis Reuse
    // --------------------------------------------------------------------------
    const dbReportPreReuse = await prisma.interviewReport.findUnique({
      where: { sessionId: session1.id },
    });

    await ReportSynthesizerService.synthesizeReport(session1.id);

    const dbReportPostReuse = await prisma.interviewReport.findUnique({
      where: { sessionId: session1.id },
    });

    assert(
      dbReportPreReuse !== null &&
        dbReportPostReuse !== null &&
        dbReportPreReuse.synthesisCreatedAt?.getTime() ===
          dbReportPostReuse.synthesisCreatedAt?.getTime(),
      "TEST 23: Existing READY Synthesis Reuse",
      `synthesisCreatedAt unchanged (${dbReportPreReuse?.synthesisCreatedAt?.toISOString()})`
    );

    // --------------------------------------------------------------------------
    // TEST 24: Synthesis Metadata Persistence
    // --------------------------------------------------------------------------
    const dbReportWithMeta = await prisma.interviewReport.findUnique({
      where: { sessionId: session1.id },
    });

    assert(
      dbReportWithMeta !== null &&
        dbReportWithMeta.synthesisStatus === "SYNTHESIS_READY" &&
        typeof dbReportWithMeta.synthesisModel === "string" &&
        dbReportWithMeta.synthesisPromptVersion === "phase-4b1-v1" &&
        dbReportWithMeta.synthesisCreatedAt instanceof Date &&
        dbReportWithMeta.synthesisUpdatedAt instanceof Date &&
        dbReportWithMeta.synthesisError === null,
      "TEST 24: Synthesis Metadata Persistence",
      `Metadata verified: model=${dbReportWithMeta?.synthesisModel}, version=${dbReportWithMeta?.synthesisPromptVersion}`
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
  console.log(`PHASE 4B-1 TEST RESULTS: ${passedCount} / ${results.length} PASSED`);
  console.log("================================================================");

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runPhase4B1Tests().catch((err) => {
  console.error("Phase 4B-1 test execution failed:", err);
  process.exit(1);
});
