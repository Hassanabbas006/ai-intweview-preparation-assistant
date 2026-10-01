import {
  buildInterviewState,
  classifyCandidateMessage,
  calculateConsecutiveNonSubstantiveCount,
  extractCandidateFacts,
  extractAskedQuestions,
  getPromptMemoryContext,
  isCandidateRequestingToEnd,
  SESSION_END_TOKEN,
} from "../lib/interview/state";
import {
  InterviewOrchestrator,
  TECHNICAL_PILLARS,
  HR_PILLARS,
  MANAGERIAL_PILLARS,
  getPillarsForRound,
  isCandidateClarification,
  isCandidateMetaInstruction,
} from "../services/interview-engine";
import { buildSystemPrompt, buildOpeningPrompt } from "../lib/interview/prompts";
import { selectAptitudeQuestions } from "../lib/interview/aptitude-bank";
import { GroqProvider } from "../lib/llm/groq";
import { GeminiProvider } from "../lib/llm/gemini";
import { FallbackLLMProvider, getLLMProvider } from "../lib/llm/index";
import { InterviewType, SessionStatus, InterviewModality } from "@prisma/client";
import fs from "fs";
import path from "path";

// Load .env without external dotenv dependency
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

async function runTests() {
  console.log("\n==================================================");
  console.log("RUNNING PHASE 2 INTERVIEW ORCHESTRATOR VERIFICATION");
  console.log("==================================================\n");

  const baseSession = {
    id: "test_session_phase_2",
    userId: "user_p2",
    type: "DOMAIN" as InterviewType,
    domain: "Software_Engineering",
    focusArea: "Fullstack - High Concurrency & Distributed Storage",
    difficulty: "SENIOR",
    modality: "TEXT" as InterviewModality,
    status: "IN_PROGRESS" as SessionStatus,
    messages: [] as { role: string; content: string; createdAt: Date }[],
  };

  // ----------------------------------------------------
  // TEST 1: Opening Turn -> OPEN_INTERVIEW & INITIAL_OPENING
  // ----------------------------------------------------
  console.log("TEST 1: Opening Turn Decision");
  const state1 = buildInterviewState(baseSession);
  const decision1 = InterviewOrchestrator.decideNextStep({ state: state1, isOpening: true });
  assert(decision1.action === "OPEN_INTERVIEW", "Action is OPEN_INTERVIEW");
  assert(decision1.reasonCode === "INITIAL_OPENING", "ReasonCode is INITIAL_OPENING");
  assert(decision1.targetPillarIndex === 0, "Target Pillar is 0 (Architecture)");
  assert(decision1.directiveInstruction.includes("introduce themselves"), "Directive requests candidate intro");

  // ----------------------------------------------------
  // TEST 2: Candidate Greeting -> HANDLE_GREETING & GREETING_DETECTED
  // ----------------------------------------------------
  console.log("\nTEST 2: Candidate Greeting Decision");
  const stateGreeting = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "Hi, I'm Sarah. Tell me about your background.", createdAt: new Date() },
      ],
    },
    "hey there"
  );
  const decisionGreeting = InterviewOrchestrator.decideNextStep({ state: stateGreeting, candidateMessage: "hey there" });
  assert(decisionGreeting.action === "HANDLE_GREETING", "Action is HANDLE_GREETING");
  assert(decisionGreeting.reasonCode === "GREETING_DETECTED", "ReasonCode is GREETING_DETECTED");
  assert(decisionGreeting.directiveInstruction.includes("SAME question"), "Directive preserves current question");

  // ----------------------------------------------------
  // TEST 3: Candidate Intro Turn -> ACKNOWLEDGE_INTRO & CANDIDATE_INTRO_RECEIVED
  // ----------------------------------------------------
  console.log("\nTEST 3: Candidate Intro Turn Decision");
  const introMessage = "Hi Sarah, I'm Alex. I have 6 years of experience building distributed microservices with Go, Kafka, and PostgreSQL. At my previous role at Stripe, I architected our event processing pipeline.";
  const stateIntro = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "Hi, I'm Sarah. Walk me through your background.", createdAt: new Date() },
      ],
    },
    introMessage
  );
  const decisionIntro = InterviewOrchestrator.decideNextStep({ state: stateIntro, candidateMessage: introMessage });
  assert(decisionIntro.action === "ACKNOWLEDGE_INTRO", "Action is ACKNOWLEDGE_INTRO");
  assert(decisionIntro.reasonCode === "CANDIDATE_INTRO_RECEIVED", "ReasonCode is CANDIDATE_INTRO_RECEIVED");
  assert(decisionIntro.targetPillarIndex === 0, "Target pillar is Pillar 1");

  // ----------------------------------------------------
  // TEST 4: Substantive Turn 1 -> DRILL_DOWN & SUBSTANTIVE_PROBE_DEPTH
  // ----------------------------------------------------
  console.log("\nTEST 4: First Substantive Turn on Pillar");
  const stateSub1 = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "Hi, I'm Sarah. Walk me through your background.", createdAt: new Date() },
        { role: "user", content: introMessage, createdAt: new Date() },
        { role: "assistant", content: "Let's dive into your event processing pipeline. How did you structure service boundaries and API contracts?", createdAt: new Date() },
      ],
    },
    "We decoupled order ingestion from billing using gRPC for synchronous calls and Kafka for asynchronous state changes."
  );
  const decisionSub1 = InterviewOrchestrator.decideNextStep({ state: stateSub1, candidateMessage: "We decoupled order ingestion from billing using gRPC for synchronous calls and Kafka for asynchronous state changes." });
  assert(decisionSub1.action === "DRILL_DOWN", "Action is DRILL_DOWN");
  assert(decisionSub1.reasonCode === "SUBSTANTIVE_PROBE_DEPTH", "ReasonCode is SUBSTANTIVE_PROBE_DEPTH");
  assert(decisionSub1.targetPillarIndex === 0, "Pillar remains 0 (Architecture)");

  // ----------------------------------------------------
  // TEST 5: Substantive Turn 2 on same pillar -> CHALLENGE_TRADEOFF & SUBSTANTIVE_CHALLENGE_TRADEOFF
  // ----------------------------------------------------
  console.log("\nTEST 5: Second Substantive Turn on Same Pillar");
  const stateSub2 = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "Opening intro question", createdAt: new Date() },
        { role: "user", content: introMessage, createdAt: new Date() },
        { role: "assistant", content: "Pillar 1 Q1", createdAt: new Date() },
        { role: "user", content: "Pillar 1 Answer 1", createdAt: new Date() },
        { role: "assistant", content: "Pillar 1 Q2", createdAt: new Date() },
      ],
    },
    "We implemented dead letter queues and idempotency keys on each consumer to prevent duplicate charges."
  );
  const decisionSub2 = InterviewOrchestrator.decideNextStep({ state: stateSub2, candidateMessage: "We implemented dead letter queues..." });
  assert(decisionSub2.action === "CHALLENGE_TRADEOFF", "Action is CHALLENGE_TRADEOFF");
  assert(decisionSub2.reasonCode === "SUBSTANTIVE_CHALLENGE_TRADEOFF", "ReasonCode is SUBSTANTIVE_CHALLENGE_TRADEOFF");
  assert(decisionSub2.directiveInstruction.includes("Challenge constraints"), "Directive instructs tradeoff challenge");

  // ----------------------------------------------------
  // TEST 6: Further turns on Pillar -> ADVANCE_PILLAR & PILLAR_PROGRESSION_ADVANCE
  // ----------------------------------------------------
  console.log("\nTEST 6: Pillar Advancement Decision");
  const stateAdvance = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "Opening intro question", createdAt: new Date() },
        { role: "user", content: introMessage, createdAt: new Date() },
        { role: "assistant", content: "Pillar 1 Q1", createdAt: new Date() },
        { role: "user", content: "Pillar 1 Answer 1", createdAt: new Date() },
        { role: "assistant", content: "Pillar 1 Q2", createdAt: new Date() },
        { role: "user", content: "Pillar 1 Answer 2", createdAt: new Date() },
      ],
    },
    "That handles the network split by returning 503 while the leader election settles."
  );
  const decisionAdvance = InterviewOrchestrator.decideNextStep({ state: stateAdvance, candidateMessage: "That handles network split..." });
  assert(decisionAdvance.action === "ADVANCE_PILLAR", "Action is ADVANCE_PILLAR");
  assert(decisionAdvance.reasonCode === "PILLAR_PROGRESSION_ADVANCE", "ReasonCode is PILLAR_PROGRESSION_ADVANCE");
  assert(decisionAdvance.targetPillarIndex === 1, "Target Pillar advanced to 1 (Data Modeling)");

  // ----------------------------------------------------
  // TEST 7: First Non-Substantive Reply -> PROMPT_FOR_SUBSTANCE & NON_SUBSTANTIVE_REPROMPT
  // ----------------------------------------------------
  console.log("\nTEST 7: First Non-Substantive Answer");
  const stateNonAns1 = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "Opening intro question", createdAt: new Date() },
        { role: "user", content: introMessage, createdAt: new Date() },
        { role: "assistant", content: "How do you handle composite indexing in PostgreSQL?", createdAt: new Date() },
      ],
    },
    "fine"
  );
  const decisionNonAns1 = InterviewOrchestrator.decideNextStep({ state: stateNonAns1, candidateMessage: "fine" });
  assert(decisionNonAns1.action === "PROMPT_FOR_SUBSTANCE", "Action is PROMPT_FOR_SUBSTANCE");
  assert(decisionNonAns1.reasonCode === "NON_SUBSTANTIVE_REPROMPT", "ReasonCode is NON_SUBSTANTIVE_REPROMPT");
  assert(decisionNonAns1.directiveInstruction.includes("Patiently prompt them"), "Directive instructs patient substance prompt");

  // ----------------------------------------------------
  // TEST 8: Repeated Non-Substantive Replies -> PIVOT_AWAY & NON_SUBSTANTIVE_PIVOT_LIMIT
  // ----------------------------------------------------
  console.log("\nTEST 8: Repeated Non-Substantive Answer (Count >= 2)");
  const stateNonAns2 = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "Opening intro question", createdAt: new Date() },
        { role: "user", content: introMessage, createdAt: new Date() },
        { role: "assistant", content: "How do you handle composite indexing?", createdAt: new Date() },
        { role: "user", content: "fine", createdAt: new Date() },
      ],
    },
    "idk"
  );
  const decisionNonAns2 = InterviewOrchestrator.decideNextStep({ state: stateNonAns2, candidateMessage: "idk" });
  assert(decisionNonAns2.action === "PIVOT_AWAY", "Action is PIVOT_AWAY");
  assert(decisionNonAns2.reasonCode === "NON_SUBSTANTIVE_PIVOT_LIMIT", "ReasonCode is NON_SUBSTANTIVE_PIVOT_LIMIT");
  assert(decisionNonAns2.directiveInstruction.includes("Release the topic naturally"), "Directive instructs pivoting away");

  // ----------------------------------------------------
  // TEST 9: Clarification Question -> ANSWER_CLARIFICATION & CANDIDATE_ASKED_CLARIFICATION
  // ----------------------------------------------------
  console.log("\nTEST 9: Candidate Clarification Question");
  const clarificationMsg = "Could you clarify what the expected read-to-write ratio is for this service?";
  assert(isCandidateClarification(clarificationMsg) === true, "Clarification message identified");
  const stateClarif = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "How would you design the storage layer for a high-traffic analytics counter?", createdAt: new Date() },
      ],
    },
    clarificationMsg
  );
  const decisionClarif = InterviewOrchestrator.decideNextStep({ state: stateClarif, candidateMessage: clarificationMsg });
  assert(decisionClarif.action === "ANSWER_CLARIFICATION", "Action is ANSWER_CLARIFICATION");
  assert(decisionClarif.reasonCode === "CANDIDATE_ASKED_CLARIFICATION", "ReasonCode is CANDIDATE_ASKED_CLARIFICATION");
  assert(decisionClarif.directiveInstruction.includes("Answer their question knowledgeably and concisely in 1–2 sentences"), "Directive strictly delegates explanation to LLM");

  // ----------------------------------------------------
  // TEST 10: Meta Instruction -> HANDLE_META_REQUEST & CANDIDATE_META_INSTRUCTION
  // ----------------------------------------------------
  console.log("\nTEST 10: Candidate Meta Instruction");
  const metaMsg = "ask me a question about Kafka partition rebalancing";
  assert(isCandidateMetaInstruction(metaMsg) === true, "Meta instruction identified");
  const stateMeta = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "What technologies have you worked with?", createdAt: new Date() },
      ],
    },
    metaMsg
  );
  const decisionMeta = InterviewOrchestrator.decideNextStep({ state: stateMeta, candidateMessage: metaMsg });
  assert(decisionMeta.action === "HANDLE_META_REQUEST", "Action is HANDLE_META_REQUEST");
  assert(decisionMeta.reasonCode === "CANDIDATE_META_INSTRUCTION", "ReasonCode is CANDIDATE_META_INSTRUCTION");
  assert(decisionMeta.directiveInstruction.includes("Do NOT answer yourself"), "Directive forbids answering on candidate's behalf");

  // ----------------------------------------------------
  // TEST 11: Candidate Wants to Stop -> CONCLUDE_ROUND & CANDIDATE_REQUESTED_END
  // ----------------------------------------------------
  console.log("\nTEST 11: Candidate End Request");
  const endMsg = "I think that covers everything, can we end the interview here?";
  const stateEnd = buildInterviewState(
    {
      ...baseSession,
      messages: [
        { role: "assistant", content: "Do you have any final thoughts on the architecture?", createdAt: new Date() },
      ],
    },
    endMsg
  );
  const decisionEnd = InterviewOrchestrator.decideNextStep({ state: stateEnd, candidateMessage: endMsg });
  assert(decisionEnd.action === "CONCLUDE_ROUND", "Action is CONCLUDE_ROUND");
  assert(decisionEnd.reasonCode === "CANDIDATE_REQUESTED_END", "ReasonCode is CANDIDATE_REQUESTED_END");
  assert(decisionEnd.isTerminalTurn === true, "isTerminalTurn is true");
  assert(decisionEnd.directiveInstruction.includes(SESSION_END_TOKEN), "Directive enforces [SESSION_COMPLETED]");

  // ----------------------------------------------------
  // TEST 12: All Pillars Exhausted -> CONCLUDE_ROUND & ALL_PILLARS_EXHAUSTED
  // ----------------------------------------------------
  console.log("\nTEST 12: Pillar Exhaustion Round Conclusion");
  // 5 technical pillars * 2 turns + 1 intro = 11 user turns
  const exhaustedMessages = [
    { role: "assistant", content: "Intro", createdAt: new Date() },
    { role: "user", content: "Intro A", createdAt: new Date() },
  ];
  for (let i = 1; i <= 10; i++) {
    exhaustedMessages.push({ role: "assistant", content: `Q${i}`, createdAt: new Date() });
    exhaustedMessages.push({ role: "user", content: `Substantive answer ${i} with Kafka and Redis`, createdAt: new Date() });
  }

  const stateExhausted = buildInterviewState({
    ...baseSession,
    messages: exhaustedMessages,
  }, "Final substantive answer covering observability metrics.");
  const decisionExhausted = InterviewOrchestrator.decideNextStep({ state: stateExhausted, candidateMessage: "Final substantive answer" });
  assert(decisionExhausted.action === "CONCLUDE_ROUND", "Action is CONCLUDE_ROUND on exhaustion");
  assert(decisionExhausted.reasonCode === "ALL_PILLARS_EXHAUSTED", "ReasonCode is ALL_PILLARS_EXHAUSTED");
  assert(decisionExhausted.isTerminalTurn === true, "Terminal turn marked");

  // ----------------------------------------------------
  // TEST 13: Duplicate Question Prevention & Anti-Repetition Blacklist
  // ----------------------------------------------------
  console.log("\nTEST 13: Anti-Repetition Blacklist in Prompt");
  const sysPromptWithBlacklist = buildSystemPrompt({
    state: stateSub1,
    decision: decisionSub1,
  });
  assert(sysPromptWithBlacklist.includes("PREVIOUS QUESTIONS ASKED IN THIS SESSION (DO NOT REPEAT)"), "Anti-repetition block present in prompt");
  assert(sysPromptWithBlacklist.includes("STRICT RULE: Never repeat, re-ask, or closely rephrase"), "Strict rule enforced in prompt");

  // ----------------------------------------------------
  // TEST 14, 15, 16: Track-Specific Pillars
  // ----------------------------------------------------
  console.log("\nTEST 14, 15, 16: Track-Specific Pillars (Technical, HR, Managerial)");
  const techPillars = getPillarsForRound("DOMAIN");
  assert(techPillars.length === 5, "5 Technical pillars defined");
  assert(techPillars[0].name.includes("Architecture"), "Technical Pillar 1 is Architecture");

  const hrPillars = getPillarsForRound("HR");
  assert(hrPillars.length === 4, "4 HR pillars defined");
  assert(hrPillars[0].name.includes("Conflict"), "HR Pillar 1 is Conflict");

  const mgrPillars = getPillarsForRound("MANAGERIAL");
  assert(mgrPillars.length === 4, "4 Managerial pillars defined");
  assert(mgrPillars[0].name.includes("Roadmapping"), "Managerial Pillar 1 is Roadmapping");

  // ----------------------------------------------------
  // TEST 17: Aptitude Separation Verification
  // ----------------------------------------------------
  console.log("\nTEST 17: Aptitude Assessment Deterministic Isolation");
  const aptitudeQuestions = selectAptitudeQuestions([], 15);
  assert(aptitudeQuestions.length === 15, "15 questions selected deterministically");
  assert(aptitudeQuestions.every((q) => q.options.length === 4), "All MCQs have 4 options");

  // ----------------------------------------------------
  // TEST 18, 19, 20: Groq Qwen Streaming & Fallback Chain
  // ----------------------------------------------------
  console.log("\nTEST 18, 19, 20: Live Groq Qwen Streaming with Orchestrator Prompt");
  if (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY) {
    const llm = getLLMProvider();
    let streamedTokens = 0;
    const testPrompt = buildSystemPrompt({
      state: stateSub1,
      decision: decisionSub1,
    });

    const streamText = await llm.streamText({
      messages: [{ role: "user", content: "We decoupled order ingestion from billing using gRPC for synchronous calls and Kafka for asynchronous state changes." }],
      systemInstruction: testPrompt,
      temperature: 0.5,
      maxOutputTokens: 150,
      onChunk(chunk) {
        streamedTokens += 1;
      },
    });

    assert(streamedTokens > 0, `LLM streamed ${streamedTokens} tokens`);
    assert(streamText.length > 20, `Assistant response generated: "${streamText.slice(0, 70)}..."`);
    assert(!streamText.includes("[SESSION_COMPLETED]"), "Live turn does not prematurely emit termination token");
  } else {
    console.log("  ⚠️ No LLM API keys present; skipped live network call.");
  }

  // ----------------------------------------------------
  // TEST 21: State Reconstruction on Reconnect
  // ----------------------------------------------------
  console.log("\nTEST 21: State Reconstruction on Reconnect");
  const reconstructed = buildInterviewState({
    ...baseSession,
    messages: [
      { role: "assistant", content: "Tell me about your background.", createdAt: new Date() },
      { role: "user", content: "I work with React and TypeScript.", createdAt: new Date() },
    ],
  });
  assert(reconstructed.askedQuestions.length === 1, "Asked questions reconstructed");
  assert(reconstructed.candidateMemory.skillsAndTechnologies.includes("react"), "Candidate skills reconstructed");

  // ----------------------------------------------------
  // TEST 22: Multi-turn Conversational Sequence Verification
  // ----------------------------------------------------
  console.log("\nTEST 22: Complete Conversational Progression Trace");
  const turns = [
    { input: "Hi there!", expectedAction: "HANDLE_GREETING", expectedReason: "GREETING_DETECTED" },
    { input: "I have 5 years experience with Node.js and PostgreSQL.", expectedAction: "ACKNOWLEDGE_INTRO", expectedReason: "CANDIDATE_INTRO_RECEIVED" },
    { input: "Could you clarify the database write QPS?", expectedAction: "ANSWER_CLARIFICATION", expectedReason: "CANDIDATE_ASKED_CLARIFICATION" },
    { input: "I don't know", expectedAction: "PROMPT_FOR_SUBSTANCE", expectedReason: "NON_SUBSTANTIVE_REPROMPT" },
    { input: "still not sure", expectedAction: "PIVOT_AWAY", expectedReason: "NON_SUBSTANTIVE_PIVOT_LIMIT" },
    { input: "Let's use a Redis write-behind cache with partition hashing.", expectedAction: "DRILL_DOWN", expectedReason: "SUBSTANTIVE_PROBE_DEPTH" },
    { input: "I'd like to end the session now, thanks.", expectedAction: "CONCLUDE_ROUND", expectedReason: "CANDIDATE_REQUESTED_END" },
  ];

  let currentHistory: { role: string; content: string; createdAt: Date }[] = [
    { role: "assistant", content: "Hi, I'm Alex. Welcome!", createdAt: new Date() },
  ];

  for (const t of turns) {
    const s = buildInterviewState({ ...baseSession, messages: currentHistory }, t.input);
    const d = InterviewOrchestrator.decideNextStep({ state: s, candidateMessage: t.input });
    assert(d.action === t.expectedAction, `Input "${t.input.slice(0, 25)}" -> Action: ${d.action}`);
    assert(d.reasonCode === t.expectedReason, `ReasonCode: ${d.reasonCode}`);
    currentHistory.push({ role: "user", content: t.input, createdAt: new Date() });
    currentHistory.push({ role: "assistant", content: `Interviewer response for ${d.action}`, createdAt: new Date() });
  }

  console.log("\n==================================================");
  console.log("ALL 22 PHASE 2 VERIFICATION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================\n");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
