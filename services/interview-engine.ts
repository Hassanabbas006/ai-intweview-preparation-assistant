import { InterviewType, SessionStatus, InterviewModality } from "@prisma/client";
import { InterviewState, classifyCandidateMessage } from "@/lib/interview/state";
import { getDomainLabel } from "@/lib/constants/domains";

export type InterviewAction =
  | "OPEN_INTERVIEW"
  | "ACKNOWLEDGE_INTRO"
  | "HANDLE_GREETING"
  | "PROMPT_FOR_SUBSTANCE"
  | "PIVOT_AWAY"
  | "ANSWER_CLARIFICATION"
  | "HANDLE_META_REQUEST"
  | "DRILL_DOWN"
  | "CHALLENGE_TRADEOFF"
  | "ADVANCE_PILLAR"
  | "CONCLUDE_ROUND";

export type DecisionReasonCode =
  | "INITIAL_OPENING"
  | "CANDIDATE_REQUESTED_END"
  | "GREETING_DETECTED"
  | "CANDIDATE_META_INSTRUCTION"
  | "CANDIDATE_ASKED_CLARIFICATION"
  | "NON_SUBSTANTIVE_REPROMPT"
  | "NON_SUBSTANTIVE_PIVOT_LIMIT"
  | "CANDIDATE_INTRO_RECEIVED"
  | "SUBSTANTIVE_PROBE_DEPTH"
  | "SUBSTANTIVE_CHALLENGE_TRADEOFF"
  | "PILLAR_PROGRESSION_ADVANCE"
  | "ALL_PILLARS_EXHAUSTED";

export interface PillarDefinition {
  index: number;
  name: string;
  description: string;
  coreConcepts: string[];
}

export interface ProgressionPolicyOptions {
  turnsPerPillarTarget?: number;     // Baseline: 2 substantive turns per pillar
  evaluationScoreOverride?: number;  // Phase 3 hook for evaluation-driven progression
  targetDifficulty?: string;         // Adaptive difficulty tier (JUNIOR, MID, SENIOR, LEAD, PRINCIPAL)
  adaptiveContext?: string;          // Compact adaptive guideline
}

export interface OrchestratorInput {
  state: InterviewState;
  candidateMessage?: string;
  isOpening?: boolean;
  options?: ProgressionPolicyOptions;
}

export interface OrchestratorDecision {
  action: InterviewAction;
  reasonCode: DecisionReasonCode;
  targetPillarIndex: number;
  targetPillarName: string;
  consecutiveTurnsOnPillar: number;
  isTerminalTurn: boolean;
  directiveInstruction: string;
  groundingKeywords: string[];
}

export const TECHNICAL_PILLARS: PillarDefinition[] = [
  {
    index: 0,
    name: "System Architecture, Component Design & Trade-offs",
    description: "Component decomposition, interface design, protocols (REST/gRPC), separation of concerns, and architectural boundaries.",
    coreConcepts: ["microservices", "modularity", "API contracts", "tradeoffs", "layering"],
  },
  {
    index: 1,
    name: "Data Modeling, Database Architecture & Storage",
    description: "Database schema design, indexing strategies, normalization vs. denormalization, transactional integrity, and SQL vs. NoSQL tradeoffs.",
    coreConcepts: ["indexing", "sharding", "transactions", "consistency", "query optimization"],
  },
  {
    index: 2,
    name: "Scalability, Concurrency, Caching & Performance",
    description: "Distributed caching strategies, rate limiting, connection pooling, concurrency controls, and high-throughput bottlenecks.",
    coreConcepts: ["redis", "caching", "locking", "throughput", "latency bottlenecks"],
  },
  {
    index: 3,
    name: "Fault Tolerance, Failure Recovery & Edge Cases",
    description: "Circuit breakers, graceful degradation, partition handling, failover mechanisms, retry strategies, and disaster recovery.",
    coreConcepts: ["circuit breakers", "failover", "retries", "dead letter queues", "resilience"],
  },
  {
    index: 4,
    name: "Security, Observability, CI/CD & Best Practices",
    description: "Authentication/authorization, telemetry (distributed tracing, metrics, logs), zero-downtime deployment pipelines, and security hygiene.",
    coreConcepts: ["distributed tracing", "metrics", "OAuth/JWT", "CI/CD", "security"],
  },
];

export const HR_PILLARS: PillarDefinition[] = [
  {
    index: 0,
    name: "Stakeholder / Team Conflict & Resolution",
    description: "Interpersonal dynamics, resolving disagreements on technical or process direction, handling pushback, and de-escalation.",
    coreConcepts: ["conflict resolution", "disagreement", "alignment", "compromise"],
  },
  {
    index: 1,
    name: "Project Ownership, Missed Deadlines & Trade-offs",
    description: "End-to-end accountability, managing setbacks or schedule slippage, risk mitigation, and proactive stakeholder communication.",
    coreConcepts: ["ownership", "deadlines", "tradeoffs", "accountability"],
  },
  {
    index: 2,
    name: "Feedback, Mentorship & Collaboration Culture",
    description: "Receiving constructive criticism, coaching struggling team members, fostering psychological safety, and knowledge sharing.",
    coreConcepts: ["feedback", "mentorship", "collaboration", "empathy"],
  },
  {
    index: 3,
    name: "Adaptability, Learning & Career Motivation",
    description: "Pivoting under changing business priorities, tackling unfamiliar technologies, and personal professional growth drivers.",
    coreConcepts: ["adaptability", "learning curve", "resilience", "motivation"],
  },
];

export const MANAGERIAL_PILLARS: PillarDefinition[] = [
  {
    index: 0,
    name: "Strategic Roadmapping & Tech Debt Prioritization",
    description: "Balancing product feature delivery with long-term architectural health, tech debt remediation, and engineering capacity planning.",
    coreConcepts: ["tech debt", "roadmap", "prioritization", "capacity"],
  },
  {
    index: 1,
    name: "People Management, Underperformance & Career Coaching",
    description: "Performance Improvement Plans (PIPs), 1-on-1 coaching models, identifying burnout, talent retention, and promotion ladders.",
    coreConcepts: ["performance management", "career growth", "coaching", "retention"],
  },
  {
    index: 2,
    name: "Cross-Functional Alignment (Product / Design / Execs)",
    description: "Bridging engineering constraints with product roadmaps, pushing back on unrealistic executive demands, and cross-team negotiation.",
    coreConcepts: ["cross-functional", "stakeholder management", "executive communication"],
  },
  {
    index: 3,
    name: "Engineering Org Topology & Team Scaling",
    description: "Structuring engineering squads, hiring rubrics, onboarding velocity, maintaining high engineering standards as team grows.",
    coreConcepts: ["org design", "hiring standards", "scaling teams", "topology"],
  },
];

/**
 * Returns the pillar definitions for a given interview round type
 */
export function getPillarsForRound(type: InterviewType): PillarDefinition[] {
  switch (type) {
    case "HR":
      return HR_PILLARS;
    case "MANAGERIAL":
      return MANAGERIAL_PILLARS;
    case "DOMAIN":
    default:
      return TECHNICAL_PILLARS;
  }
}

/**
 * Checks if candidate message is asking a clarification question
 */
export function isCandidateClarification(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;

  const clarificationStarters = [
    /^(could|can|would|do|are|is|should)\s+(you|we|i)\s+(clarify|specify|explain|mean|tell|give|repeat|rephrase|restate)/i,
    /^(what|which|how|where|why)\s+(do you mean|is the|are the|should i|would be|qps|traffic|scale|latency|was the question|did you say)/i,
    /^(are we assuming|is this assuming|does this mean|should this be|can you repeat|could you repeat|repeat the question)/i,
    /^(pardon|excuse me|repeat please|say again|come again)/i,
  ];

  const hasClarificationStarter = clarificationStarters.some((p) => p.test(normalized));
  const isQuestion = normalized.endsWith("?") || hasClarificationStarter;

  // Ensure it's a relatively short inquiry (under 35 words) or direct question
  const wordCount = normalized.split(/\s+/).length;
  return isQuestion && wordCount <= 35 && hasClarificationStarter;
}

/**
 * Checks if candidate is giving a meta command or instructing the interviewer
 */
export function isCandidateMetaInstruction(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  const metaPatterns = [
    /\b(ask me|test me on|quiz me on|can you ask me|give me a question about|test my knowledge)\b/i,
    /\b(ask me how are you|ask me how i am)\b/i,
    /\b(ignore (all )?previous instructions|system prompt|disregard instructions|you are now|act as a)\b/i,
  ];
  return metaPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Deterministic Interview Orchestrator
 */
export class InterviewOrchestrator {
  /**
   * Evaluates whether to advance to the next topic pillar based on current turns and pluggable policy
   */
  static shouldAdvancePillar(
    consecutiveTurnsOnPillar: number,
    options?: ProgressionPolicyOptions
  ): boolean {
    const targetTurns = options?.turnsPerPillarTarget ?? 2;
    return consecutiveTurnsOnPillar >= targetTurns;
  }

  /**
   * Main deterministic decision engine for interview turn orchestration
   */
  static decideNextStep(input: OrchestratorInput): OrchestratorDecision {
    const { state, candidateMessage, isOpening, options } = input;
    const pillars = getPillarsForRound(state.type);
    const totalPillars = pillars.length;

    // 1. Check Candidate Intent to End
    if (state.isCandidateEnding) {
      return {
        action: "CONCLUDE_ROUND",
        reasonCode: "CANDIDATE_REQUESTED_END",
        targetPillarIndex: totalPillars - 1,
        targetPillarName: pillars[totalPillars - 1].name,
        consecutiveTurnsOnPillar: 0,
        isTerminalTurn: true,
        directiveInstruction:
          "The candidate explicitly requested to end the interview. Warmly thank them for their time and technical conversation in 1-2 polite sentences. MANDATORY: You MUST append [SESSION_COMPLETED] at the very end. DO NOT ask any further questions.",
        groundingKeywords: ["conclude", "wrap up", "thank you"],
      };
    }

    // 2. Check Opening Turn
    if (isOpening || state.messages.length === 0) {
      const firstPillar = pillars[0];
      return {
        action: "OPEN_INTERVIEW",
        reasonCode: "INITIAL_OPENING",
        targetPillarIndex: 0,
        targetPillarName: firstPillar.name,
        consecutiveTurnsOnPillar: 0,
        isTerminalTurn: false,
        directiveInstruction:
          "Introduce yourself briefly (name and role) and warmly invite the candidate to introduce themselves and share their background and recent work. Do NOT ask any technical questions on this turn.",
        groundingKeywords: firstPillar.coreConcepts,
      };
    }

    // 3. Check Casual Greeting
    if (state.isGreeting) {
      const currentPillar = pillars[Math.min(Math.floor(state.askedQuestions.length / 2), totalPillars - 1)];
      return {
        action: "HANDLE_GREETING",
        reasonCode: "GREETING_DETECTED",
        targetPillarIndex: currentPillar.index,
        targetPillarName: currentPillar.name,
        consecutiveTurnsOnPillar: 0,
        isTerminalTurn: false,
        directiveInstruction:
          "The candidate sent a casual greeting/small talk. Respond warmly in 1 short phrase (e.g. 'Hey! Good to have you here.'), then immediately continue with the SAME question you were already asking.",
        groundingKeywords: currentPillar.coreConcepts,
      };
    }

    // 4. Check Candidate Meta Instruction ("ask me about Kafka", etc.)
    if (candidateMessage && isCandidateMetaInstruction(candidateMessage)) {
      const currentPillar = pillars[Math.min(Math.floor(state.askedQuestions.length / 2), totalPillars - 1)];
      return {
        action: "HANDLE_META_REQUEST",
        reasonCode: "CANDIDATE_META_INSTRUCTION",
        targetPillarIndex: currentPillar.index,
        targetPillarName: currentPillar.name,
        consecutiveTurnsOnPillar: 0,
        isTerminalTurn: false,
        directiveInstruction:
          "The candidate asked you to test them on a specific topic. Do NOT answer yourself or speak on their behalf. Directly ask them a concrete question about that requested topic to keep them in the hot seat.",
        groundingKeywords: currentPillar.coreConcepts,
      };
    }

    // 5. Check Candidate Clarification Question (Strict Directive Boundary)
    if (candidateMessage && isCandidateClarification(candidateMessage)) {
      const currentPillar = pillars[Math.min(Math.floor(state.askedQuestions.length / 2), totalPillars - 1)];
      return {
        action: "ANSWER_CLARIFICATION",
        reasonCode: "CANDIDATE_ASKED_CLARIFICATION",
        targetPillarIndex: currentPillar.index,
        targetPillarName: currentPillar.name,
        consecutiveTurnsOnPillar: 0,
        isTerminalTurn: false,
        directiveInstruction:
          "The candidate asked a clarifying question regarding the scenario. Answer their question knowledgeably and concisely in 1–2 sentences, then prompt them to proceed with their proposed design.",
        groundingKeywords: currentPillar.coreConcepts,
      };
    }

    // 6. Check Non-Substantive Replies (Count >= 2 -> PIVOT_AWAY, Count === 1 -> PROMPT_FOR_SUBSTANCE)
    if (state.nonSubstantiveCount >= 2) {
      const nextPillarIndex = Math.min(
        Math.floor((state.askedQuestions.length + 1) / 2),
        totalPillars - 1
      );
      const nextPillar = pillars[nextPillarIndex];
      return {
        action: "PIVOT_AWAY",
        reasonCode: "NON_SUBSTANTIVE_PIVOT_LIMIT",
        targetPillarIndex: nextPillar.index,
        targetPillarName: nextPillar.name,
        consecutiveTurnsOnPillar: 0,
        isTerminalTurn: false,
        directiveInstruction: `The candidate has given ${state.nonSubstantiveCount} non-substantive replies in a row without answering. DO NOT loop or repeat formulaic phrases. Release the topic naturally using varied phrasing (e.g. 'All good, let\\'s look at...', 'No problem at all — let\\'s explore...') and IMMEDIATELY pivot to a fresh question from ${nextPillar.name}.`,
        groundingKeywords: nextPillar.coreConcepts,
      };
    }

    if (state.nonSubstantiveCount === 1) {
      const currentPillar = pillars[Math.min(Math.floor(state.askedQuestions.length / 2), totalPillars - 1)];
      return {
        action: "PROMPT_FOR_SUBSTANCE",
        reasonCode: "NON_SUBSTANTIVE_REPROMPT",
        targetPillarIndex: currentPillar.index,
        targetPillarName: currentPillar.name,
        consecutiveTurnsOnPillar: 0,
        isTerminalTurn: false,
        directiveInstruction:
          "The candidate gave a minimal or filler reply. DO NOT use affirmative openers ('Got it', 'Understood', 'Makes sense'). Patiently prompt them for concrete details, tools, or architectural specifics using varied phrasing.",
        groundingKeywords: currentPillar.coreConcepts,
      };
    }

    // 7. Check Candidate Intro Turn
    if (state.isIntroTurn) {
      const firstPillar = pillars[0];
      return {
        action: "ACKNOWLEDGE_INTRO",
        reasonCode: "CANDIDATE_INTRO_RECEIVED",
        targetPillarIndex: 0,
        targetPillarName: firstPillar.name,
        consecutiveTurnsOnPillar: 0,
        isTerminalTurn: false,
        directiveInstruction: `The candidate just shared their background. Acknowledge 1 specific project, technology, or domain they mentioned in 1 brief sentence. DO NOT use stock AI clichés ('Awesome!', 'Great background!'). Immediately ask your first opening question from Pillar 1: ${firstPillar.name}, connecting it naturally to their background.`,
        groundingKeywords: firstPillar.coreConcepts,
      };
    }

    // 8. Regular Substantive Turns & Pillar Progression Calculation
    const previousSubstantiveUserTurns = state.messages.filter(
      (m) =>
        m.role === "user" &&
        classifyCandidateMessage(m.content) === "SUBSTANTIVE" &&
        !isCandidateClarification(m.content) &&
        !isCandidateMetaInstruction(m.content)
    ).length;

    // Substantive answers given after the initial intro turn
    const substantiveAnswersCount = Math.max(0, previousSubstantiveUserTurns - 1);
    const turnsPerPillar = options?.turnsPerPillarTarget ?? 2;

    // Check if candidate has completed all pillars
    if (substantiveAnswersCount >= totalPillars * turnsPerPillar) {
      return {
        action: "CONCLUDE_ROUND",
        reasonCode: "ALL_PILLARS_EXHAUSTED",
        targetPillarIndex: totalPillars - 1,
        targetPillarName: pillars[totalPillars - 1].name,
        consecutiveTurnsOnPillar: turnsPerPillar,
        isTerminalTurn: true,
        directiveInstruction:
          "All core pillars for this interview have been thoroughly explored. Give a brief, polite 1-sentence closing thank you and technical wrap-up. MANDATORY: You MUST append [SESSION_COMPLETED] at the very end. DO NOT ask any further questions.",
        groundingKeywords: ["conclude", "wrap up", "thank you"],
      };
    }

    const turnsPerCycle = turnsPerPillar + 1; // e.g. 3 turns per pillar: DrillDown (turn 1), Tradeoff (turn 2), Advance (turn 3)
    const calculatedPillarIndex = Math.min(
      Math.floor(substantiveAnswersCount / turnsPerCycle),
      totalPillars - 1
    );
    const turnsOnCurrentPillar = (substantiveAnswersCount % turnsPerCycle) + 1;
    const currentPillar = pillars[calculatedPillarIndex];

    // Check if policy indicates advancing to the next pillar
    if (turnsOnCurrentPillar > turnsPerPillar && calculatedPillarIndex < totalPillars - 1) {
      const nextPillar = pillars[calculatedPillarIndex + 1];
      return {
        action: "ADVANCE_PILLAR",
        reasonCode: "PILLAR_PROGRESSION_ADVANCE",
        targetPillarIndex: nextPillar.index,
        targetPillarName: nextPillar.name,
        consecutiveTurnsOnPillar: 0,
        isTerminalTurn: false,
        directiveInstruction: `The candidate has thoroughly discussed ${currentPillar.name}. Smoothly transition the conversation forward to Pillar ${nextPillar.index + 1}: ${nextPillar.name}. Ask a fresh architectural scenario probing ${nextPillar.description}.`,
        groundingKeywords: nextPillar.coreConcepts,
      };
    }

    // Substantive Turn 2 on same pillar: Challenge Tradeoff & Failure Modes
    if (turnsOnCurrentPillar === 2) {
      return {
        action: "CHALLENGE_TRADEOFF",
        reasonCode: "SUBSTANTIVE_CHALLENGE_TRADEOFF",
        targetPillarIndex: currentPillar.index,
        targetPillarName: currentPillar.name,
        consecutiveTurnsOnPillar: turnsOnCurrentPillar,
        isTerminalTurn: false,
        directiveInstruction: `The candidate provided their design for ${currentPillar.name}. Challenge constraints, failure scenarios, edge cases, or high-concurrency bottlenecks (e.g. 'What breaks first under heavy load?' or 'How do you handle partition recovery?').`,
        groundingKeywords: currentPillar.coreConcepts,
      };
    }

    // Substantive Turn 1 on pillar: Drill Down into Specifics
    return {
      action: "DRILL_DOWN",
      reasonCode: "SUBSTANTIVE_PROBE_DEPTH",
      targetPillarIndex: currentPillar.index,
      targetPillarName: currentPillar.name,
      consecutiveTurnsOnPillar: turnsOnCurrentPillar,
      isTerminalTurn: false,
      directiveInstruction: `The candidate provided a substantive answer on ${currentPillar.name}. Anchor to a specific tool, parameter, or concept they mentioned and probe deeper into the internal mechanics, trade-offs, or concrete trade-offs.`,
      groundingKeywords: currentPillar.coreConcepts,
    };
  }
}
