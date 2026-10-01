import {
  InterviewEvaluator,
  TurnEvaluationSchema,
  RubricScoreSchema,
  TurnEvaluationRecord,
  PillarMasteryState,
} from "../services/evaluator";
import {
  buildInterviewState,
  classifyCandidateMessage,
  isCandidateRequestingToEnd,
} from "../lib/interview/state";
import {
  InterviewOrchestrator,
  TECHNICAL_PILLARS,
} from "../services/interview-engine";
import { GroqProvider } from "../lib/llm/groq";
import { MockLLMProvider } from "../lib/llm/mock";
import { InterviewType, SessionStatus, InterviewModality } from "@prisma/client";
import fs from "fs";
import path from "path";

// Load .env
try {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val.trim();
      }
    }
  }
} catch {}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase3ATests() {
  console.log("\n==================================================");
  console.log("RUNNING PHASE 3A EVALUATION & MASTERY VERIFICATION");
  console.log("==================================================\n");

  const baseSession = {
    id: "test_session_p3a",
    userId: "user_p3a",
    type: "DOMAIN" as InterviewType,
    domain: "Software_Engineering",
    focusArea: "Distributed Systems & Scalability",
    difficulty: "MID",
    modality: "TEXT" as InterviewModality,
    status: "IN_PROGRESS" as SessionStatus,
    messages: [] as { role: string; content: string; createdAt: Date }[],
  };

  // ----------------------------------------------------
  // TEST 1: Strict Zod Schema Validation for TurnEvaluation
  // ----------------------------------------------------
  console.log("TEST 1: TurnEvaluation Zod Schema Validation");
  const validJson = {
    overallScore: 88,
    confidence: 0.95,
    rubricScores: [
      {
        dimension: "Component Decoupling",
        score: 90,
        weight: 1.0,
        evidenceSnippet: "decoupled ingestion using Kafka",
        feedback: "Clear architectural boundaries",
      },
    ],
    demonstratedConcepts: ["Kafka", "microservices"],
    missingConcepts: ["backpressure"],
    strengths: ["Strong understanding of event-driven decoupling"],
    weaknesses: ["Did not mention backpressure mitigation"],
    masterySignal: "MASTERY_HIGH",
    recommendedDifficulty: "INCREASE",
  };
  const parsed = TurnEvaluationSchema.parse(validJson);
  assert(parsed.overallScore === 88, "overallScore validated correctly");
  assert(parsed.masterySignal === "MASTERY_HIGH", "masterySignal validated");
  assert(parsed.rubricScores.length === 1, "rubricScores array validated");

  let caughtZodError = false;
  try {
    // Missing required rubricScores and invalid score
    TurnEvaluationSchema.parse({
      overallScore: 150, // Invalid >100
      rubricScores: [],
    });
  } catch {
    caughtZodError = true;
  }
  assert(caughtZodError, "Invalid schema rejected by Zod parser");

  // ----------------------------------------------------
  // TEST 2: Fast-Path Deterministic Bypass Filter
  // ----------------------------------------------------
  console.log("\nTEST 2: Fast-Path Deterministic Bypass Filter (0ms / 0 Token Overhead)");
  assert(InterviewEvaluator.isFastPathBypass("hello") === true, "Greeting bypassed");
  assert(InterviewEvaluator.isFastPathBypass("hi there") === true, "Greeting phrase bypassed");
  assert(InterviewEvaluator.isFastPathBypass("fine") === true, "Filler 'fine' bypassed");
  assert(InterviewEvaluator.isFastPathBypass("idk") === true, "Evasion 'idk' bypassed");
  assert(InterviewEvaluator.isFastPathBypass("sdfghjkl") === true, "Gibberish bypassed");
  assert(InterviewEvaluator.isFastPathBypass("Could you clarify the expected QPS?") === true, "Clarification inquiry bypassed");
  assert(InterviewEvaluator.isFastPathBypass("ask me a question about Redis") === true, "Meta instruction bypassed");
  assert(InterviewEvaluator.isFastPathBypass("Can we wrap up here?") === true, "End session request bypassed");
  assert(
    InterviewEvaluator.isFastPathBypass("We used a Redis cluster with master-replica replication and read through cache.") === false,
    "Substantive technical answer is NOT bypassed"
  );

  // Fast-path evaluation output check
  const fastPathRecord = await InterviewEvaluator.evaluateTurn({
    sessionId: "test_session_p3a",
    turnSequenceNumber: 1,
    candidateMessage: "hello there",
    pillarIndex: 0,
    pillarName: "Architecture",
  });
  assert(fastPathRecord.evaluationStatus === "COMPLETED", "Fast-path status is COMPLETED");
  assert(fastPathRecord.overallScore === null, "Fast-path score is null (no fake score)");
  assert(fastPathRecord.evaluatorMetadata.model === "fast-path-filter", "Metadata flags fast-path-filter");

  // ----------------------------------------------------
  // TEST 3: Zero-Fabrication Failure Policy (score = null on error)
  // ----------------------------------------------------
  console.log("\nTEST 3: Zero-Fabrication Failure Policy (No Fabricated 70 Scores)");
  class FailingLLMProvider {
    name = "failing-mock";
    async generateText(): Promise<string> {
      throw new Error("Simulated LLM Provider Timeout / Rate Limit");
    }
    async streamText(): Promise<string> {
      throw new Error("Stream failed");
    }
  }

  const failedRecord = await InterviewEvaluator.evaluateTurn({
    sessionId: "test_session_p3a",
    turnSequenceNumber: 2,
    candidateMessage: "We implemented sharding with consistent hashing.",
    pillarIndex: 0,
    pillarName: "Architecture",
    llmProvider: new FailingLLMProvider() as any,
  });

  assert(failedRecord.evaluationStatus === "FAILED", "Status is FAILED on provider error");
  assert(failedRecord.overallScore === null, "overallScore is strictly NULL (No fabricated 70)");
  assert(failedRecord.rubricScores === null, "rubricScores is strictly NULL");
  assert(failedRecord.masterySignal === null, "masterySignal is strictly NULL");
  assert(failedRecord.recommendedDifficulty === "MAINTAIN", "Recommended difficulty defaults to MAINTAIN");
  assert(Boolean(failedRecord.errorMessage?.includes("Simulated LLM")), "Error message captured in diagnostics");

  // ----------------------------------------------------
  // TEST 4: Mastery State Tracking & EMA Calculation
  // ----------------------------------------------------
  console.log("\nTEST 4: Mastery State Tracking & Exponential Moving Average (alpha=0.65)");
  const initialMastery = InterviewEvaluator.createInitialPillarMastery("TECH-0", "System Architecture");
  assert(initialMastery.rollingScore === 0, "Initial rolling score is 0");
  assert(initialMastery.totalSubstantiveTurns === 0, "Initial turns count is 0");

  // Turn 1 evaluation: Score 90
  const turn1Eval: TurnEvaluationRecord = {
    id: "eval_1",
    sessionId: "s1",
    turnSequenceNumber: 1,
    pillarSlug: "TECH-0",
    pillarName: "System Architecture",
    evaluationStatus: "COMPLETED",
    overallScore: 90,
    confidence: 0.9,
    rubricScores: [],
    demonstratedConcepts: ["microservices", "gRPC"],
    missingConcepts: [],
    strengths: ["Strong contracts"],
    weaknesses: [],
    masterySignal: "MASTERY_HIGH",
    recommendedDifficulty: "INCREASE",
    evaluatorMetadata: { model: "mock", promptVersion: "v1", latencyMs: 10, timestamp: new Date().toISOString() },
    errorMessage: null,
  };

  const mastery1 = InterviewEvaluator.updatePillarMastery(initialMastery, turn1Eval);
  assert(mastery1.rollingScore === 90, "Turn 1 EMA score is 90");
  assert(mastery1.totalSubstantiveTurns === 1, "Turn count is 1");
  assert(mastery1.consecutiveHighScoreTurns === 1, "consecutiveHighScoreTurns is 1");
  assert(mastery1.masteryLevel === "EXEMPLARY", "masteryLevel is EXEMPLARY");
  assert(mastery1.demonstratedConcepts.includes("microservices"), "Captured demonstrated concepts");

  // Turn 2 evaluation: Score 94 -> EMA = 0.65 * 94 + 0.35 * 90 = 61.1 + 31.5 = 92.6 -> 93
  const turn2Eval: TurnEvaluationRecord = {
    ...turn1Eval,
    id: "eval_2",
    turnSequenceNumber: 2,
    overallScore: 94,
    demonstratedConcepts: ["kafka"],
  };

  const mastery2 = InterviewEvaluator.updatePillarMastery(mastery1, turn2Eval);
  assert(mastery2.rollingScore === 93, "Turn 2 EMA score is 93 (0.65*94 + 0.35*90)");
  assert(mastery2.totalSubstantiveTurns === 2, "Turn count is 2");
  assert(mastery2.consecutiveHighScoreTurns === 2, "consecutiveHighScoreTurns is 2");
  assert(mastery2.demonstratedConcepts.includes("kafka"), "Merged new demonstrated concept");

  // ----------------------------------------------------
  // TEST 5: Failed Turn does NOT corrupt Mastery State
  // ----------------------------------------------------
  console.log("\nTEST 5: Failed Turn Preservation (Mastery Unchanged)");
  const masteryAfterFailure = InterviewEvaluator.updatePillarMastery(mastery2, failedRecord);
  assert(masteryAfterFailure.rollingScore === 93, "Rolling score unchanged on FAILED evaluation");
  assert(masteryAfterFailure.totalSubstantiveTurns === 2, "Turn count unchanged on FAILED evaluation");
  assert(masteryAfterFailure.consecutiveHighScoreTurns === 2, "High score streak preserved");
  assert(masteryAfterFailure.lastEvaluatedTurnSequenceNumber === 2, "Sequence number unchanged");

  // ----------------------------------------------------
  // TEST 6: Out-of-Order / Stale Turn Rejection
  // ----------------------------------------------------
  console.log("\nTEST 6: Stale / Out-of-Order Evaluation Rejection");
  const staleTurn1Late: TurnEvaluationRecord = {
    ...turn1Eval,
    turnSequenceNumber: 1, // Arrived after turn 2
    overallScore: 30,      // Outdated low score
  };
  const masteryAfterStale = InterviewEvaluator.updatePillarMastery(mastery2, staleTurn1Late);
  assert(masteryAfterStale.rollingScore === 93, "Stale turn rejected from rolling score calculation");
  assert(masteryAfterStale.totalSubstantiveTurns === 2, "Turn count not incremented for stale evaluation");

  // ----------------------------------------------------
  // TEST 7: Adaptive Difficulty 2-Turn Hysteresis Engine
  // ----------------------------------------------------
  console.log("\nTEST 7: Adaptive Difficulty 2-Turn Hysteresis Engine");
  // 1 high turn -> MAINTAIN
  const adapt1 = InterviewEvaluator.calculateAdaptiveDifficulty("MID", 1, 0);
  assert(adapt1.action === "MAINTAIN", "1 high turn maintains difficulty");
  assert(adapt1.nextLevel === "MID", "Level remains MID");

  // 2 consecutive high turns -> INCREASE (MID -> SENIOR)
  const adapt2 = InterviewEvaluator.calculateAdaptiveDifficulty("MID", 2, 0);
  assert(adapt2.action === "INCREASE", "2 consecutive high turns triggers INCREASE");
  assert(adapt2.nextLevel === "SENIOR", "Level advances from MID to SENIOR");

  // Hysteresis boundary clamp at PRINCIPAL
  const adaptClamped = InterviewEvaluator.calculateAdaptiveDifficulty("PRINCIPAL", 3, 0);
  assert(adaptClamped.action === "MAINTAIN", "Clamped at maximum PRINCIPAL level");
  assert(adaptClamped.nextLevel === "PRINCIPAL", "Level remains PRINCIPAL");

  // 2 consecutive low turns -> DECREASE (SENIOR -> MID)
  const adaptLow = InterviewEvaluator.calculateAdaptiveDifficulty("SENIOR", 0, 2);
  assert(adaptLow.action === "DECREASE", "2 consecutive low turns triggers DECREASE");
  assert(adaptLow.nextLevel === "MID", "Level decreases from SENIOR to MID");

  // ----------------------------------------------------
  // TEST 8: Aptitude Track 100% Deterministic Evaluation
  // ----------------------------------------------------
  console.log("\nTEST 8: Aptitude Track Deterministic Evaluation (0 LLM Calls)");
  const aptCorrect = InterviewEvaluator.evaluateAptitudeAnswer("B", "B", "Quantitative", 1);
  assert(aptCorrect.overallScore === 100, "Correct option scores 100");
  assert(aptCorrect.masterySignal === "MASTERY_HIGH", "Correct option signal is MASTERY_HIGH");
  assert(aptCorrect.recommendedDifficulty === "INCREASE", "Correct option recommends INCREASE");
  assert(aptCorrect.evaluatorMetadata.latencyMs === 0, "Deterministic execution has 0ms latency");

  const aptIncorrect = InterviewEvaluator.evaluateAptitudeAnswer("A", "C", "Logical Reasoning", 2);
  assert(aptIncorrect.overallScore === 0, "Incorrect option scores 0");
  assert(aptIncorrect.masterySignal === "CRITICAL_GAP", "Incorrect option signal is CRITICAL_GAP");
  assert(aptIncorrect.recommendedDifficulty === "DECREASE", "Incorrect option recommends DECREASE");

  // ----------------------------------------------------
  // TEST 9: Live Evaluator with Groq Qwen / Primary LLM
  // ----------------------------------------------------
  console.log("\nTEST 9: Live LLM Structured Evaluation Execution");
  if (process.env.GROQ_API_KEY) {
    const groq = new GroqProvider(process.env.GROQ_API_KEY);
    const liveEval = await InterviewEvaluator.evaluateTurn({
      sessionId: "test_session_p3a",
      turnSequenceNumber: 1,
      candidateMessage:
        "For our high-throughput payment ingestion, we deployed a distributed Kafka cluster with 12 partitions partitioned by merchantId. Each consumer uses manual commit after inserting into PostgreSQL within an ACID transaction with an idempotency table to prevent double-charging.",
      pillarIndex: 0,
      pillarName: TECHNICAL_PILLARS[0].name,
      pillarSlug: "TECH-0",
      roundType: "DOMAIN",
      currentDifficulty: "SENIOR",
      llmProvider: groq,
      timeoutMs: 15000,
    });

    assert(
      typeof liveEval.overallScore === "number" &&
        liveEval.overallScore >= 0 &&
        liveEval.overallScore <= 100,
      `Live LLM scored substantive answer ${liveEval.overallScore}/100 (Signal: ${liveEval.masterySignal})`
    );
    assert(liveEval.rubricScores !== null && liveEval.rubricScores.length > 0, "Generated structured rubric scores");
    assert(liveEval.demonstratedConcepts.length > 0, `Captured demonstrated concepts: ${liveEval.demonstratedConcepts.join(", ")}`);
    console.log(`  ✓ Live LLM evaluation produced score ${liveEval.overallScore}/100 in ${liveEval.evaluatorMetadata.latencyMs}ms`);
  } else {
    console.log("  ⚠️ GROQ_API_KEY not present; skipped live LLM network test.");
  }

  // ----------------------------------------------------
  // TEST 10: Phase 2 Orchestration Authority Integration
  // ----------------------------------------------------
  console.log("\nTEST 10: Phase 2 Progression Authority Preservation");
  // Substantive turn 1 on Pillar 0 with high evaluation score
  const stateTurn1 = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "Tell me about your background.", createdAt: new Date() },
        { role: "user", content: "I build microservices with Go and PostgreSQL.", createdAt: new Date() },
        { role: "assistant", content: "How do you design your service boundaries?", createdAt: new Date() },
      ],
    },
    "We use gRPC with protobufs and domain-driven design boundaries."
  );

  // Orchestrator decision on Turn 1
  const decisionTurn1 = InterviewOrchestrator.decideNextStep({
    state: stateTurn1,
    candidateMessage: "We use gRPC with protobufs and domain-driven design boundaries.",
    options: {
      evaluationScoreOverride: 95, // High score
      turnsPerPillarTarget: 2,     // Policy requires 2 substantive turns
    },
  });

  // MUST remain on Pillar 0 (DRILL_DOWN) because turn count (1) is below target (2)
  assert(decisionTurn1.action === "DRILL_DOWN", "High score does NOT prematurely force transition on turn 1");
  assert(decisionTurn1.targetPillarIndex === 0, "Target pillar remains Pillar 0");

  console.log("\n==================================================");
  console.log("ALL 10 PHASE 3A VERIFICATION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================\n");
}

runPhase3ATests().catch((err) => {
  console.error("Phase 3A Test Suite Failed:", err);
  process.exit(1);
});
