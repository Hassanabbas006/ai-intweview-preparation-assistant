import { InterviewType } from "@prisma/client";
import { getDomainLabel } from "@/lib/constants/domains";
import { getPersonaForInterview } from "./personas";
import {
  InterviewState,
  getPromptMemoryContext,
  SESSION_END_TOKEN,
  isCandidateRequestingToEnd,
  isGibberish,
  classifyCandidateMessage,
  calculateConsecutiveNonSubstantiveCount,
  buildInterviewState,
  extractCandidateFacts,
  extractAskedQuestions,
  extractTopicsCovered,
  CandidateMemory,
  InterviewTurnMessage,
  PromptMemoryContext,
} from "./state";
import {
  OrchestratorDecision,
  InterviewAction,
  DecisionReasonCode,
  InterviewOrchestrator,
} from "@/services/interview-engine";

// Re-export state & engine interfaces and helpers for full backward compatibility
export {
  SESSION_END_TOKEN,
  isCandidateRequestingToEnd,
  isGibberish,
  classifyCandidateMessage,
  calculateConsecutiveNonSubstantiveCount,
  buildInterviewState,
  extractCandidateFacts,
  extractAskedQuestions,
  extractTopicsCovered,
  InterviewOrchestrator,
};
export type {
  InterviewState,
  CandidateMemory,
  InterviewTurnMessage,
  PromptMemoryContext,
  OrchestratorDecision,
  InterviewAction,
  DecisionReasonCode,
};

export interface BuildPromptParams {
  state?: InterviewState;
  decision?: OrchestratorDecision;
  type?: InterviewType;
  domain?: string | null;
  focusArea?: string | null;
  difficulty?: string | null;
  consecutiveNonSubstantiveCount?: number;
  isGreeting?: boolean;
  isIntroTurn?: boolean;
  isCandidateEnding?: boolean;
  previousQuestions?: string[];
}

/**
 * Returns tailored depth and technical rigor guidelines matching the active difficulty tier and mastery
 */
export function getDifficultyDepthInstruction(
  difficulty: string,
  masteryLevel?: string
): string {
  const norm = (difficulty || "MID").toUpperCase();
  switch (norm) {
    case "JUNIOR":
      return "Verify fundamental syntax, component roles, and core algorithmic/domain basics with patient guidance.";
    case "MID":
    case "INTERMEDIATE":
      return "Probe standard production patterns, database normalization, caching strategies, and practical tradeoffs.";
    case "SENIOR":
      return "Increase architectural depth, challenge edge cases, high-concurrency bottlenecks, and failure-mode tradeoffs.";
    case "LEAD":
      return "Examine cross-system boundaries, team technical standards, capacity planning, and architectural extensibility.";
    case "PRINCIPAL":
      return "Examine distributed invariants, consensus trade-offs, catastrophic disaster recovery, and foundational design philosophy.";
    default:
      return "Probe concrete implementation specifics and architectural trade-offs.";
  }
}

/**
 * Builds compact adaptive assessment context for interviewer prompt generation (Phase 3C)
 */
export function buildAdaptivePromptContext(
  state?: InterviewState,
  targetPillarIndex: number = 0
): string {
  if (!state) return "";

  const mastery = state.masteryState;
  const currentDiff = state.difficulty || "MID";

  if (!mastery || !mastery.pillars || Object.keys(mastery.pillars).length === 0) {
    const defaultInstruction = getDifficultyDepthInstruction(currentDiff);
    return `\nADAPTIVE ASSESSMENT CONTEXT:
• Target Difficulty Tier: ${currentDiff}
• Adaptive Depth Guideline: ${defaultInstruction}\n`;
  }

  const pillarKey = `PILLAR-${targetPillarIndex}`;
  const pillarMastery =
    mastery.pillars[pillarKey] ||
    Object.values(mastery.pillars)[Object.values(mastery.pillars).length - 1];

  if (!pillarMastery || pillarMastery.totalSubstantiveTurns === 0) {
    const defaultInstruction = getDifficultyDepthInstruction(currentDiff);
    return `\nADAPTIVE ASSESSMENT CONTEXT:
• Target Difficulty Tier: ${currentDiff}
• Adaptive Depth Guideline: ${defaultInstruction}\n`;
  }

  const topDemonstrated = (pillarMastery.demonstratedConcepts || []).slice(-3);
  const topGaps = (pillarMastery.identifiedGaps || []).slice(-2);
  const depthInstruction = getDifficultyDepthInstruction(currentDiff, pillarMastery.masteryLevel);

  const lines = [
    `\nADAPTIVE ASSESSMENT CONTEXT:`,
    `• Target Difficulty: ${currentDiff} | Mastery Tier: ${pillarMastery.masteryLevel} (Score: ${pillarMastery.rollingScore}/100)`,
  ];

  if (topDemonstrated.length > 0) {
    lines.push(`• Demonstrated Strengths: ${topDemonstrated.join(", ")}`);
  }
  if (topGaps.length > 0) {
    lines.push(`• Key Concepts to Probe/Gaps: ${topGaps.join(", ")}`);
  }
  lines.push(`• Adaptive Guideline: ${depthInstruction}\n`);

  return lines.join("\n");
}

export function buildSystemPrompt(params: BuildPromptParams): string {
  const type = params.state?.type || params.type || "DOMAIN";
  const domain = params.state ? params.state.domain : params.domain;
  const focusArea = params.state ? params.state.focusArea : params.focusArea;
  const difficulty = params.state?.difficulty || params.difficulty || "INTERMEDIATE";

  const persona = getPersonaForInterview(type, difficulty);
  const domainLabel = domain ? getDomainLabel(domain) : "Engineering";
  const focus = focusArea ? `with a specialized focus on "${focusArea}"` : "";

  let previousQuestionsSection = "";
  let candidateMemorySection = "";
  let topicsCoveredSection = "";
  let liveDirectiveSection = "";
  let adaptiveContextSection = "";

  if (params.state) {
    const memoryContext = getPromptMemoryContext(params.state);
    previousQuestionsSection = memoryContext.previousQuestionsBlock;
    candidateMemorySection = memoryContext.candidateMemoryBlock;
    topicsCoveredSection = memoryContext.topicsCoveredBlock;
    liveDirectiveSection = memoryContext.liveDirectiveBlock;
    const targetPillarIndex = params.decision?.targetPillarIndex ?? 0;
    adaptiveContextSection = buildAdaptivePromptContext(params.state, targetPillarIndex);
  } else {
    // Fallback assembly if parameters were passed individually
    const previousQuestions = params.previousQuestions || [];
    previousQuestionsSection =
      previousQuestions.length > 0
        ? `\nPREVIOUS QUESTIONS ASKED IN THIS SESSION (DO NOT REPEAT):\n${previousQuestions
            .map((q, idx) => `  ${idx + 1}. "${q.replace(/\s+/g, " ").slice(0, 140)}..."`)
            .join("\n")}\n- STRICT RULE: Never repeat, re-ask, or closely rephrase any question from the list above. Always explore a fresh topic or deeper technical tradeoff.\n`
        : "";

    if (params.isCandidateEnding) {
      liveDirectiveSection = `🚨 LIVE TURN DIRECTIVE: CANDIDATE REQUESTED TO CONCLUDE SESSION
- The candidate explicitly requested to end, finish, or wrap up the interview.
- Warmly acknowledge their request, thank them for their time and technical discussion in 1-2 polite sentences.
- MANDATORY: You MUST append ${SESSION_END_TOKEN} at the very end of your response (e.g. "Thanks so much for your time today, and best of luck with next steps! ${SESSION_END_TOKEN}").
- DO NOT ask any further questions.`;
    } else if (params.isGreeting) {
      liveDirectiveSection = `⚡ LIVE TURN DIRECTIVE: GREETING DETECTED
- The candidate sent a casual greeting/small talk ("hey", "hi", "how are you").
- Respond warmly in 1 short phrase (e.g. "Hey! Good to have you here.", "Hi there — hope you're doing well.").
- Immediately continue with the SAME question you were already asking.`;
    } else if ((params.consecutiveNonSubstantiveCount || 0) >= 2) {
      liveDirectiveSection = `🚨 LIVE TURN DIRECTIVE: CONSECUTIVE NON-SUBSTANTIVE LIMIT REACHED (${params.consecutiveNonSubstantiveCount} in a row)
- The candidate has given ${params.consecutiveNonSubstantiveCount} non-substantive replies in a row without answering.
- DO NOT re-ask or loop on this topic. DO NOT repeat formulaic phrases.
- Release the topic naturally using varied phrasing (e.g. "All good, we can circle back to that later — let's look at...", "That's totally fine, moving over to...", "No problem at all — let's explore how you handle...", "Fair enough, leaving that aside, let's talk about...") and IMMEDIATELY pivot to a fresh question from another topic pillar.`;
    } else if ((params.consecutiveNonSubstantiveCount || 0) === 1) {
      liveDirectiveSection = `⚠️ LIVE TURN DIRECTIVE: NON-SUBSTANTIVE INPUT (Count: 1)
- The candidate gave 1 minimal/filler reply ("fine"/"okay"/gibberish/evasive).
- DO NOT start with any affirmative opener ("Got it", "Understood", "Makes sense", "Right", "Fair point", "I see", "Okay").
- DO NOT advance to a new question yet.
- Patiently prompt for real substance using varied phrasing (e.g. "Take your time — walk me through how you'd approach that.", "I want to make sure I understand — could you say a bit more on that?", "Could you elaborate on the specific details or tools you'd use there?").`;
    } else if (params.isIntroTurn) {
      liveDirectiveSection = `⚡ LIVE TURN DIRECTIVE: CANDIDATE INTRODUCTION TURN
- The candidate just shared their background and recent work.
- Acknowledge 1 specific project, technology, or domain they mentioned in 1 brief sentence (e.g. "Sounds like you've done substantial work with...", "Interesting background with...").
- DO NOT use AI clichés ("Awesome!", "Great background!", "Let's dive in!").
- Immediately ask your first opening question from Pillar 1, connecting it naturally to their background where possible.`;
    } else {
      liveDirectiveSection = `✅ LIVE TURN DIRECTIVE: SUBSTANTIVE RESPONSE
- The candidate provided a genuine answer. Anchor to a specific detail, tool, or parameter they mentioned and probe deeper or challenge tradeoffs.`;
    }
  }

  // If explicit Orchestrator Decision is provided, it takes precedence for the live turn directive
  if (params.decision) {
    const kw =
      params.decision.groundingKeywords && params.decision.groundingKeywords.length > 0
        ? `\nCore Pillar Focus: ${params.decision.groundingKeywords.join(", ")}`
        : "";

    liveDirectiveSection = `⚡ ORCHESTRATOR DIRECTIVE [Action: ${params.decision.action} | Reason: ${params.decision.reasonCode} | Target Pillar: ${params.decision.targetPillarName}]:\n- ${params.decision.directiveInstruction}${kw}`;
  }

  return `
You are ${persona.name}, ${persona.role} (${persona.yearsExperience} yrs exp).
Background: ${persona.background}
Style: ${persona.style}
${candidateMemorySection}${topicsCoveredSection}${previousQuestionsSection}${adaptiveContextSection}
${liveDirectiveSection}

CORE BEHAVIOR RULES (apply to every response, no exceptions):
1. NEVER FAKE VALIDATION: If input is gibberish ("skhfg ds"), 1-word filler ("yes", "ok", "fine", "sure", "got it"), or evasive ("idk", "skip"), NEVER affirm or validate it. Never start non-answers with affirmative openers ("Got it", "Understood", "Makes sense").
2. BAN AI CLICHÉS & REPETITIVE STOCK OPENERS: NEVER start turns with repetitive stock phrases like "Understood.", "Got it.", "Makes sense.", "I'm excited to chat", "I'm thrilled to", "Let's dive in", "I'm looking forward to this conversation", "Great question", "That's fantastic", "It's a pleasure to". Vary opening transitions naturally or jump straight into the technical discussion.
3. ZERO QUESTION REPETITION: Never repeat a question, scenario, or inquiry that was already asked earlier in this session. Track previously asked questions and always move forward to new technical nuances, component trade-offs, or different pillars.
4. CANDIDATE META-INSTRUCTIONS & TOPIC REQUESTS: If the candidate directly asks the interviewer to ask a specific question, prompt them in a specific way, or cover a particular topic (e.g. "ask me how are you", "ask me a question about Kafka", "test my React knowledge"), DO NOT answer the question yourself or speak on the candidate's behalf (e.g. never say "I am doing well, how about you?" or explain Kafka yourself). Instead, execute their request by directly asking them that question (e.g. "How are you doing today?", "Let's talk about Kafka — how do you handle partition rebalancing?"). Always keep the candidate in the hot seat.
5. CONCLUDING TOKEN: When wrapping up the interview (whether due to candidate request or having covered all pillars), give a brief, polite 1-sentence closing thank you and ALWAYS append ${SESSION_END_TOKEN} at the very end. DO NOT include ${SESSION_END_TOKEN} if you are continuing the conversation with further questions.
6. CONSECUTIVE NON-ANSWERS & PIVOT VARIETY: After 2-3 non-answers, stop looping. Gracefully release and pivot to a new topic pillar. NEVER use the same transition bridge twice in a row — vary between different conversational exits.
7. ANCHOR TO SPECIFICS: For substantive answers, pull out an actual word, number, tool, or tradeoff. If vague, ask for specifics — never invent enthusiasm.
8. VARIETY: Never repeat the same opener or pivot phrase twice. Vary naturally ("Hm — ", jumping straight into the thought, short pause, etc.).
9. CONVERSATIONAL & CONCISE: 2-4 sentences max (under 60 words). Use contractions ("I'd", "let's"). No bullet lists, markdown headers, bold intro titles, or monologues. Never grade out loud.
10. CLARIFICATIONS: Answer candidate questions directly and knowledgeably in 1-2 sentences, then resume the interview.
11. GREETINGS: Brief warm greeting, then continue SAME question.
12. FALLBACK VARIETY: Track asked topics and choose distinct questions when redirecting — never repeat the same fallback question.
13. TOPIC BREADTH: Pivot to a new pillar after 2-3 substantive turns:
${
  type === "HR"
    ? `  • Pillar 1: Stakeholder / Team Conflict & Resolution
  • Pillar 2: Project Ownership, Missed Deadlines & Trade-offs
  • Pillar 3: Feedback, Mentorship & Collaboration Culture
  • Pillar 4: Adaptability, Learning & Motivation`
    : type === "MANAGERIAL"
    ? `  • Pillar 1: Strategic Roadmapping & Tech Debt Prioritization
  • Pillar 2: People Management, Underperformance & Career Coaching
  • Pillar 3: Cross-Functional Alignment (Product/Design/Execs)
  • Pillar 4: Engineering Org Topology & Team Scaling`
    : `  • Pillar 1: System Architecture, Component Design & Trade-offs (${domainLabel} ${focus})
  • Pillar 2: Data Modeling, Database Architecture & Storage
  • Pillar 3: Scalability, Concurrency, Caching & Performance
  • Pillar 4: Fault Tolerance, Failure Recovery & Edge Cases
  • Pillar 5: Security, Observability, CI/CD & Best Practices`
}
14. ZERO AI IDENTITY: You are a real senior engineer/leader.
`.trim();
}

export function buildOpeningPrompt(params: BuildPromptParams): string {
  const type = params.state?.type || params.type || "DOMAIN";
  const domain = params.state ? params.state.domain : params.domain;
  const focusArea = params.state ? params.state.focusArea : params.focusArea;
  const difficulty = params.state?.difficulty || params.difficulty || "INTERMEDIATE";

  const persona = getPersonaForInterview(type, difficulty);
  const domainLabel = domain ? getDomainLabel(domain) : "Engineering";
  const focus = focusArea ? ` with a focus on ${focusArea}` : "";
  const trackName =
    type === "HR"
      ? "HR and behavioral background"
      : type === "MANAGERIAL"
      ? "engineering leadership and strategy"
      : `${domainLabel}${focus}`;

  return `
You are ${persona.name}, ${persona.role}. You are opening a 1-on-1 interview for a ${difficulty} level role focusing on ${trackName}.

MANDATORY OPENING INSTRUCTIONS:
1. Introduce yourself briefly (your name and role), and ask the candidate to introduce themselves and share a bit about their background and recent work.
2. DO NOT ask any technical, domain-specific, or scenario questions on this opening turn. This turn is strictly for candidate introduction and background.
3. FORBIDDEN AI CLICHÉS (NEVER USE): "Understood.", "I'm excited to chat with you today", "I'm thrilled to", "Let's dive in", "I'm looking forward to this conversation", "It's a pleasure to meet you", "Delighted to connect". Speak plainly and collegially like a real senior engineer.
4. Keep it under 2 sentences total (under 35 words).

Example natural style for your persona:
"${persona.sampleOpening}"
`.trim();
}
