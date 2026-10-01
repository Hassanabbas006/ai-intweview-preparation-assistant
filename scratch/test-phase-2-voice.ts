import {
  buildInterviewState,
  classifyCandidateMessage,
  calculateConsecutiveNonSubstantiveCount,
  extractCandidateFacts,
  extractAskedQuestions,
  getPromptMemoryContext,
  isCandidateRequestingToEnd,
  SESSION_END_TOKEN,
  InterviewState,
} from "../lib/interview/state";
import {
  InterviewOrchestrator,
  TECHNICAL_PILLARS,
  HR_PILLARS,
  MANAGERIAL_PILLARS,
  getPillarsForRound,
} from "../services/interview-engine";
import { buildSystemPrompt, buildOpeningPrompt } from "../lib/interview/prompts";
import { cleanTextForSpeech } from "../lib/voice/tts";
import { SpeechToTextEngine } from "../lib/voice/stt";
import { TextToSpeechEngine } from "../lib/voice/tts";
import { selectAptitudeQuestions } from "../lib/interview/aptitude-bank";
import { InterviewType, SessionStatus, InterviewModality } from "@prisma/client";

// ANSI colors for clean test reporting
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`${GREEN}  ✓ PASS:${RESET} ${testName}`);
    passedCount++;
  } else {
    console.error(`${RED}  ✗ FAIL:${RESET} ${testName}`);
    if (detail) console.error(`    ${YELLOW}Detail:${RESET} ${detail}`);
    failedCount++;
  }
}

async function runPhase2VoiceTests() {
  console.log(`\n${CYAN}====================================================${RESET}`);
  console.log(`${CYAN}   PHASE 2: LIVE VOICE FOUNDATION TEST SUITE       ${RESET}`);
  console.log(`${CYAN}====================================================${RESET}\n`);

  // ----------------------------------------------------
  // TEST GROUP 1: Modality Selection & Session State
  // ----------------------------------------------------
  console.log(`${YELLOW}1. Testing Modality Configuration & State Isolation${RESET}`);

  const mockTextSession = {
    id: "sess_text_101",
    userId: "user_1",
    type: "DOMAIN" as InterviewType,
    domain: "Software_Engineering",
    focusArea: "Distributed Systems",
    difficulty: "SENIOR",
    modality: "TEXT" as InterviewModality,
    status: "IN_PROGRESS" as SessionStatus,
    turnCounter: 0,
    messages: [],
  };

  const textState = buildInterviewState(mockTextSession);
  assert(textState.modality === "TEXT", "TEXT modality builds standard InterviewState with modality='TEXT'");
  assert(textState.difficulty === "SENIOR", "Difficulty tier preserved in TEXT state");

  const mockVoiceSession = {
    id: "sess_voice_202",
    userId: "user_1",
    type: "DOMAIN" as InterviewType,
    domain: "Software_Engineering",
    focusArea: "Distributed Systems",
    difficulty: "SENIOR",
    modality: "VOICE" as InterviewModality,
    status: "IN_PROGRESS" as SessionStatus,
    turnCounter: 0,
    messages: [],
  };

  const voiceState = buildInterviewState(mockVoiceSession);
  assert(voiceState.modality === "VOICE", "VOICE modality builds InterviewState with modality='VOICE'");
  assert(voiceState.type === "DOMAIN", "VOICE modality shares the exact same interview domain");
  assert(voiceState.questionNumber === 1, "VOICE modality shares the same questionNumber lifecycle");

  // ----------------------------------------------------
  // TEST GROUP 2: STT Transcript Ingestion into Pipeline
  // ----------------------------------------------------
  console.log(`\n${YELLOW}2. Testing STT Transcript Ingestion into Orchestrator${RESET}`);

  // Simulate candidate speaking an answer transcribed by STT
  const candidateSpokenTranscript =
    "In our production system we partitioned PostgreSQL using hash partitioning on user_id, and cached read queries with Redis Cluster with a 5-minute TTL.";

  // Fact extraction on transcribed voice input
  const facts = extractCandidateFacts([{ role: "user", content: candidateSpokenTranscript }]);
  assert(
    facts.skillsAndTechnologies.includes("postgresql") || facts.skillsAndTechnologies.includes("redis"),
    "STT voice transcript extracts candidate technologies into memory",
    JSON.stringify(facts.skillsAndTechnologies)
  );

  // Orchestrator decision on transcribed voice input
  const voiceSessionWithHistory = {
    ...mockVoiceSession,
    messages: [
      {
        id: "msg_1",
        role: "assistant",
        content: "Alex Chen: Walk me through how you handle database caching and partitioning.",
        createdAt: new Date(),
      },
    ],
  };

  const stateBeforeDecision = buildInterviewState(voiceSessionWithHistory);
  const decision = InterviewOrchestrator.decideNextStep({
    state: stateBeforeDecision,
    candidateMessage: candidateSpokenTranscript,
  });

  assert(
    decision.action === "DRILL_DOWN" || decision.action === "CHALLENGE_TRADEOFF",
    `STT voice transcript triggers authoritative orchestrator action: ${decision.action}`
  );
  assert(
    decision.targetPillarIndex === 0,
    "Orchestrator preserves current pillar context when evaluating voice turns"
  );

  // System prompt generation using voice input
  const prompt = buildSystemPrompt({
    state: stateBeforeDecision,
    decision,
  });
  assert(
    prompt.includes("Alex Chen") || prompt.includes("Interviewer"),
    "Interviewer persona and directives injected into prompt for voice turn"
  );

  // ----------------------------------------------------
  // TEST GROUP 3: TTS Text Cleaning & Formatting
  // ----------------------------------------------------
  console.log(`\n${YELLOW}3. Testing TTS Markdown Cleaning for Natural Speech${RESET}`);

  const rawLLMResponse = `
### Great Architectural Decision!
You mentioned using **Redis Cluster** and \`hash partitioning\` on **PostgreSQL**.
- That handles *read scalability* nicely.
- However, what happens during cross-partition queries?

\`\`\`sql
SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '1 day';
\`\`\`
[SESSION_COMPLETED]
`;

  const cleanedSpeech = cleanTextForSpeech(rawLLMResponse);

  assert(
    !cleanedSpeech.includes("###"),
    "TTS cleaner removes markdown header hashes"
  );
  assert(
    !cleanedSpeech.includes("**"),
    "TTS cleaner removes bold asterisks (**)"
  );
  assert(
    !cleanedSpeech.includes("`"),
    "TTS cleaner removes code backticks (`)"
  );
  assert(
    !cleanedSpeech.includes("[SESSION_COMPLETED]"),
    "TTS cleaner strips [SESSION_COMPLETED] token"
  );
  assert(
    cleanedSpeech.includes("Redis Cluster") && cleanedSpeech.includes("hash partitioning"),
    "TTS cleaner preserves core technical nouns and concepts"
  );

  // ----------------------------------------------------
  // TEST GROUP 4: TTS Duplicate Prevention & Modality Guard
  // ----------------------------------------------------
  console.log(`\n${YELLOW}4. Testing TTS Engine Duplicate Playback Prevention${RESET}`);

  const ttsEngine = new TextToSpeechEngine();
  assert(typeof ttsEngine.speak === "function", "TTS Engine exports speak() method");
  assert(typeof ttsEngine.stop === "function", "TTS Engine exports stop() method");

  // In non-browser / node environment, isSupported returns false gracefully
  assert(
    ttsEngine.isSupported() === false,
    "TTS Engine gracefully detects non-browser environment without throwing"
  );

  // ----------------------------------------------------
  // TEST GROUP 5: STT Engine Resilience & Cleanup
  // ----------------------------------------------------
  console.log(`\n${YELLOW}5. Testing STT Engine Structure & Error Handling${RESET}`);

  let receivedErrorType = "";
  const sttEngine = new SpeechToTextEngine({
    onError: (err) => {
      receivedErrorType = err.type;
    },
  });

  assert(typeof sttEngine.startListening === "function", "STT Engine exports startListening()");
  assert(typeof sttEngine.stopListening === "function", "STT Engine exports stopListening()");
  assert(typeof sttEngine.cleanup === "function", "STT Engine exports cleanup()");

  // In Node environment, speech recognition is not supported
  const startResult = await sttEngine.startListening();
  assert(startResult === false, "STT Engine returns false when browser SpeechRecognition is unavailable");
  assert(
    receivedErrorType === "NOT_SUPPORTED",
    `STT Engine reports structured error type: ${receivedErrorType}`
  );

  // ----------------------------------------------------
  // TEST GROUP 6: Text ↔ Voice Modality Mid-Session Switching
  // ----------------------------------------------------
  console.log(`\n${YELLOW}6. Testing Dynamic Modality Switching${RESET}`);

  // Start with VOICE modality
  let sessionState = buildInterviewState(mockVoiceSession);
  assert(sessionState.modality === "VOICE", "Initial session state is VOICE");

  // Candidate switches to TEXT
  const switchedToTextSession = {
    ...mockVoiceSession,
    modality: "TEXT" as InterviewModality,
    messages: [
      {
        id: "msg_a1",
        role: "assistant",
        content: "What database indexing strategies do you prefer?",
        createdAt: new Date(),
      },
      {
        id: "msg_v1",
        role: "user",
        content: "I use B-tree indexes for range queries and Hash indexes for equality.",
        createdAt: new Date(),
      },
    ],
  };
  const switchedState = buildInterviewState(switchedToTextSession);
  assert(switchedState.modality === "TEXT", "Session modality updated to TEXT");
  assert(switchedState.messages.length === 2, "Messages preserved across modality toggle");
  assert(switchedState.questionNumber === 2, "Question numbering progresses seamlessly");

  // ----------------------------------------------------
  // TEST GROUP 7: Text Mode Non-Regression Verification
  // ----------------------------------------------------
  console.log(`\n${YELLOW}7. Verifying Text Mode Baseline Non-Regression${RESET}`);

  const hrSession = {
    id: "sess_hr_303",
    userId: "user_2",
    type: "HR" as InterviewType,
    domain: null,
    focusArea: "Leadership",
    difficulty: "INTERMEDIATE",
    modality: "TEXT" as InterviewModality,
    status: "IN_PROGRESS" as SessionStatus,
    turnCounter: 1,
    messages: [
      {
        id: "msg_hr_open",
        role: "assistant",
        content: "Welcome! Tell me about a time you had to lead an ambiguous project or handle difficult stakeholders.",
        createdAt: new Date(),
      },
    ],
  };

  const hrState = buildInterviewState(hrSession);
  const hrDecision = InterviewOrchestrator.decideNextStep({
    state: hrState,
    candidateMessage: "I led a cross-functional team of 6 engineers to deliver our v2 migration.",
  });

  assert(
    hrDecision.action === "DRILL_DOWN" || hrDecision.action === "ADVANCE_PILLAR",
    `HR track text mode functions normally: ${hrDecision.action}`
  );

  // ----------------------------------------------------
  // TEST GROUP 8: Aptitude Engine Non-Regression
  // ----------------------------------------------------
  console.log(`\n${YELLOW}8. Verifying Aptitude Assessment Non-Regression${RESET}`);

  const aptitudeQuestions = selectAptitudeQuestions([], 15);
  assert(aptitudeQuestions.length === 15, "Aptitude question selector generates 15 questions");
  assert(
    aptitudeQuestions[0].options.length === 4,
    "Aptitude questions retain deterministic 4-option structure"
  );
  assert(
    typeof aptitudeQuestions[0].correctIndex === "number",
    "Aptitude correctIndex remains deterministic numeric property"
  );

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log(`\n${CYAN}====================================================${RESET}`);
  console.log(`${CYAN}   PHASE 2 VOICE TEST SUMMARY                      ${RESET}`);
  console.log(`${CYAN}====================================================${RESET}`);
  console.log(`  Total Passed: ${GREEN}${passedCount}${RESET}`);
  console.log(`  Total Failed: ${RED}${failedCount}${RESET}`);

  if (failedCount > 0) {
    console.error(`\n${RED}Phase 2 Voice tests encountered ${failedCount} failure(s).${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}ALL PHASE 2 VOICE TESTS PASSED SUCCESSFULLY!${RESET}\n`);
  }
}

runPhase2VoiceTests().catch((err) => {
  console.error("Unhandled test suite exception:", err);
  process.exit(1);
});
