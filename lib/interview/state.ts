import { InterviewType, SessionStatus, InterviewModality } from "@prisma/client";
import { getDomainLabel } from "@/lib/constants/domains";

export const SESSION_END_TOKEN = "[SESSION_COMPLETED]";

export interface InterviewTurnMessage {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt?: Date | string;
}

export interface CandidateMemory {
  skillsAndTechnologies: string[];
  projectsAndArchitectures: string[];
  experienceHighlights: string[];
}

export interface InterviewState {
  sessionId: string;
  userId?: string;
  type: InterviewType;
  domain?: string | null;
  focusArea?: string | null;
  difficulty: string;
  modality: InterviewModality;
  status: SessionStatus;

  // Turn and Question Metrics
  questionNumber: number;
  currentQuestion?: string;
  askedQuestions: string[];
  topicsCovered: string[];

  // Non-substantive tracking
  nonSubstantiveCount: number;
  isGreeting: boolean;
  isIntroTurn: boolean;
  isCandidateEnding: boolean;

  // Candidate Memory
  candidateMemory: CandidateMemory;

  // Raw conversation history
  messages: InterviewTurnMessage[];

  // Phase 3C: Optional Session Mastery State
  masteryState?: any;
}

export interface PromptMemoryContext {
  previousQuestionsBlock: string;
  candidateMemoryBlock: string;
  topicsCoveredBlock: string;
  liveDirectiveBlock: string;
}

/**
 * Minimal fillers, short acknowledgments, and evasions
 */
export const MINIMAL_FILLERS = new Set([
  "ok", "okay", "yes", "yeah", "yep", "sure", "alright", "all right", "got it",
  "k", "fine", "cool", "right", "understood", "true", "no", "nope", "yup", "nah",
  "good", "nice", "great", "thanks", "thank you", "thx", "ty", "done",
  "idk", "not sure", "no idea", "skip", "pass", "dunno", "nothing", "none",
  "no clue", "cant say", "can't say", "dont know", "don't know", "whatever",
  "maybe", "probably", "i guess", "guess so", "dont care", "don't care",
  "i dont know", "i don't know", "i do not know", "i have no idea", "have no idea",
  "i'm not sure", "im not sure", "i am not sure", "still not sure", "still unsure",
  "no clue at all", "i have no clue", "never used it", "haven't used it",
]);

export const GREETINGS = new Set([
  "hi", "hey", "hello", "good morning", "good afternoon", "good evening",
  "how are you", "how are you doing", "hows it going", "how's it going",
  "whats up", "what's up", "hey there", "hi there", "hello there", "good day",
]);

const KNOWN_TECH_KEYWORDS = new Set([
  "javascript", "typescript", "python", "java", "c++", "c#", "go", "golang", "rust",
  "ruby", "php", "swift", "kotlin", "scala", "sql", "nosql", "html", "css", "sass",
  "react", "react.js", "next.js", "nextjs", "vue", "vue.js", "angular", "svelte",
  "node", "node.js", "nodejs", "express", "express.js", "nest", "nestjs", "fastapi",
  "django", "flask", "spring", "spring boot", ".net", "dotnet",
  "postgresql", "postgres", "mysql", "mongodb", "redis", "cassandra", "dynamodb",
  "sqlite", "elasticsearch", "kafka", "rabbitmq", "aws", "gcp", "azure", "docker",
  "kubernetes", "k8s", "terraform", "ci/cd", "github actions", "jenkins",
  "graphql", "rest", "grpc", "websockets", "tailwind", "prisma", "typeorm",
  "microservices", "serverless", "event-driven", "distributed systems", "pytorch",
  "tensorflow", "scikit-learn", "pandas", "numpy", "powerbi", "tableau"
]);

/**
 * Checks if candidate explicitly asks to end, wrap up, or stop the interview session
 */
export function isCandidateRequestingToEnd(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  const endPatterns = [
    /\b(end|stop|finish|close|conclude|wrap up|wrap-up)\b.*\b(interview|session|round|here|call|meeting)\b/,
    /\b(let'?s|can we|i want to|i'd like to|could we|i need to)\b.*\b(wrap up|end|finish|stop|conclude)\b/,
    /^(i'?m done|im done|i am done|that'?s all|thats all|let'?s wrap up|lets end|end interview|stop interview|finish interview)[.!]?$/,
  ];
  return endPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Checks if a string appears to be meaningless gibberish / keyboard mash
 */
export function isGibberish(text: string): boolean {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean || clean.length < 2) return true;

  // Single repeated character: e.g. "aaaaa", "zzzz"
  if (/^(.)\1+$/.test(clean)) return true;

  // Only digits or symbols with no words
  if (/^\d+$/.test(clean)) return true;

  // Check if every word in the text has 3+ letters and zero vowels
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const allVowelless = words.every((w) => {
    const letters = w.replace(/[^a-z]/g, "");
    return letters.length >= 3 && !/[aeiouy]/.test(letters);
  });
  if (allVowelless) return true;

  return false;
}

/**
 * Classifies a candidate message into GREETING, NON_SUBSTANTIVE, or SUBSTANTIVE
 */
export function classifyCandidateMessage(
  text: string
): "GREETING" | "NON_SUBSTANTIVE" | "SUBSTANTIVE" {
  const normalized = text.trim().toLowerCase().replace(/^[.,!?;:]+|[.,!?;:]+$/g, "");
  if (!normalized) return "NON_SUBSTANTIVE";

  // Check greetings
  if (
    GREETINGS.has(normalized) ||
    (/^(hi|hey|hello|greetings|good\s+(morning|afternoon|evening))\b/i.test(normalized) &&
      normalized.split(/\s+/).length <= 4)
  ) {
    return "GREETING";
  }

  // Check minimal fillers / evasions
  if (MINIMAL_FILLERS.has(normalized)) {
    return "NON_SUBSTANTIVE";
  }

  // Check evasion patterns (e.g. "I don't know", "idk honestly", "not sure")
  const evasionRegex = /^(i\s+)?(don'?t|do\s+not|have\s+no|haven'?t|can'?t|cannot|still\s+not|idk|dunno|no\s+idea|not\s+sure|no\s+clue)\b/i;
  if (evasionRegex.test(normalized) && normalized.split(/\s+/).length <= 8) {
    return "NON_SUBSTANTIVE";
  }

  // Check gibberish
  if (isGibberish(normalized)) {
    return "NON_SUBSTANTIVE";
  }

  // Very short response (1-2 words under 12 characters total) with no technical substance
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && normalized.length < 12) {
    const hasTech = words.some((w) => KNOWN_TECH_KEYWORDS.has(w));
    if (!hasTech && (MINIMAL_FILLERS.has(normalized) || isGibberish(normalized) || words.length === 1)) {
      return "NON_SUBSTANTIVE";
    }
  }

  return "SUBSTANTIVE";
}

/**
 * Calculates consecutive non-substantive replies from conversation history + latest message
 */
export function calculateConsecutiveNonSubstantiveCount(
  previousMessages: { role: string; content: string }[],
  currentMessage?: string
): { count: number; isGreeting: boolean } {
  if (currentMessage !== undefined) {
    const currentClassification = classifyCandidateMessage(currentMessage);
    if (currentClassification === "GREETING") {
      return { count: 0, isGreeting: true };
    }

    if (currentClassification === "SUBSTANTIVE") {
      return { count: 0, isGreeting: false };
    }

    // Current message is NON_SUBSTANTIVE (count starts at 1)
    let count = 1;
    const userMessages = previousMessages
      .filter((m) => m.role === "user")
      .slice()
      .reverse();

    for (const prevUserMsg of userMessages) {
      const classification = classifyCandidateMessage(prevUserMsg.content);
      if (classification === "NON_SUBSTANTIVE") {
        count++;
      } else {
        break;
      }
    }

    return { count, isGreeting: false };
  }

  // Backward walk through previous user messages only
  let count = 0;
  const userMessages = previousMessages
    .filter((m) => m.role === "user")
    .slice()
    .reverse();

  for (const msg of userMessages) {
    const classification = classifyCandidateMessage(msg.content);
    if (classification === "NON_SUBSTANTIVE") {
      count++;
    } else {
      break;
    }
  }

  return { count, isGreeting: false };
}

function escapeTechPattern(tech: string): RegExp {
  const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startBound = /^\w/.test(tech) ? "\\b" : "";
  const endBound = /\w$/.test(tech) ? "\\b" : "(?![a-zA-Z0-9])";
  return new RegExp(`${startBound}${escaped}${endBound}`, "i");
}

/**
 * Conservatively extracts genuine candidate facts mentioned by candidate in substantive answers
 */
export function extractCandidateFacts(messages: { role: string; content: string }[]): CandidateMemory {
  const skillsSet = new Set<string>();
  const projectsSet = new Set<string>();
  const experienceSet = new Set<string>();

  const userSubstantiveMessages = messages
    .filter((m) => m.role === "user" && classifyCandidateMessage(m.content) === "SUBSTANTIVE")
    .map((m) => m.content);

  for (const text of userSubstantiveMessages) {
    const lower = text.toLowerCase();

    // 1. Scan for known technologies
    KNOWN_TECH_KEYWORDS.forEach((tech) => {
      const regex = escapeTechPattern(tech);
      if (regex.test(lower)) {
        skillsSet.add(tech);
      }
    });

    // 2. Scan for years of experience mentions
    const expMatches = text.match(/\b(?:\d+|\w+)\s+(?:years|yrs|year)\s+(?:of\s+)?(?:experience|working|building|developing|in)?\b/gi);
    if (expMatches) {
      for (const m of expMatches) {
        if (m.trim().length > 3) experienceSet.add(m.trim());
      }
    }

    // 3. Scan for project & system keywords
    const projectPatterns = [
      /\b(?:built|built a|designed|architected|developed|implemented|created|led|migrated)\s+([a-z0-9\s\-]{4,35}?)(?:\.|,|;|\band\b|\busing\b|\bwith\b|\bat\b|$)/gi,
    ];

    for (const pattern of projectPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const snippet = match[1]?.trim();
        if (snippet && snippet.length >= 4 && snippet.split(" ").length <= 5 && !/^(it|this|that|them|something|a lot)$/i.test(snippet)) {
          projectsSet.add(snippet);
        }
      }
    }
  }

  return {
    skillsAndTechnologies: Array.from(skillsSet).slice(0, 15),
    projectsAndArchitectures: Array.from(projectsSet).slice(0, 5),
    experienceHighlights: Array.from(experienceSet).slice(0, 3),
  };
}

/**
 * Extracts previously asked questions from assistant message turns
 */
export function extractAskedQuestions(messages: { role: string; content: string }[]): string[] {
  return messages
    .filter((m) => m.role === "assistant" && m.content.trim().length > 0)
    .map((m) => m.content.replace(/\[SESSION_COMPLETED\]/g, "").trim());
}

/**
 * Derives topics and pillars touched across previous questions and focus areas
 */
export function extractTopicsCovered(
  messages: { role: string; content: string }[],
  focusArea?: string | null,
  domain?: string | null
): string[] {
  const topics: string[] = [];
  if (focusArea) topics.push(focusArea);
  if (domain) topics.push(getDomainLabel(domain));

  const asked = extractAskedQuestions(messages);
  for (const q of asked) {
    const firstSentence = q.split(/[.?!]/)[0]?.trim();
    if (firstSentence && firstSentence.length > 10 && firstSentence.length < 80) {
      topics.push(firstSentence);
    }
  }

  return Array.from(new Set(topics)).slice(0, 6);
}

/**
 * Reconstructs the complete InterviewState from database session, messages, and optional current turn
 */
export function buildInterviewState(
  sessionData: {
    id: string;
    userId?: string;
    type: InterviewType;
    domain?: string | null;
    focusArea?: string | null;
    difficulty?: string | null;
    masteryState?: any;
    modality?: InterviewModality;
    status: SessionStatus;
    messages: { role: string; content: string; createdAt?: Date | string }[];
  },
  currentCandidateMessage?: string
): InterviewState {
  const allMessages: InterviewTurnMessage[] = (sessionData.messages || []).map((m) => ({
    role: m.role as "system" | "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt,
  }));

  const askedQuestions = extractAskedQuestions(allMessages);
  const currentQuestion = askedQuestions.length > 0 ? askedQuestions[askedQuestions.length - 1] : undefined;
  const questionNumber = askedQuestions.length + 1;
  const topicsCovered = extractTopicsCovered(allMessages, sessionData.focusArea, sessionData.domain);

  const { count: nonSubstantiveCount, isGreeting } = calculateConsecutiveNonSubstantiveCount(
    allMessages,
    currentCandidateMessage
  );

  const isCandidateEnding = currentCandidateMessage ? isCandidateRequestingToEnd(currentCandidateMessage) : false;
  const previousSubstantiveUserMessages = allMessages.filter(
    (m) => m.role === "user" && classifyCandidateMessage(m.content) === "SUBSTANTIVE"
  );
  const isIntroTurn =
    previousSubstantiveUserMessages.length === 0 &&
    typeof currentCandidateMessage === "string" &&
    classifyCandidateMessage(currentCandidateMessage) === "SUBSTANTIVE";

  const candidateMemory = extractCandidateFacts(
    currentCandidateMessage
      ? [...allMessages, { role: "user", content: currentCandidateMessage }]
      : allMessages
  );

  return {
    sessionId: sessionData.id,
    userId: sessionData.userId,
    type: sessionData.type,
    domain: sessionData.domain,
    focusArea: sessionData.focusArea,
    difficulty: sessionData.difficulty || "INTERMEDIATE",
    masteryState: sessionData.masteryState || null,
    modality: sessionData.modality || "TEXT",
    status: sessionData.status,
    questionNumber,
    currentQuestion,
    askedQuestions,
    topicsCovered,
    nonSubstantiveCount,
    isGreeting,
    isIntroTurn,
    isCandidateEnding,
    candidateMemory,
    messages: allMessages,
  };
}

/**
 * Generates compact memory context strings for prompt injection
 */
export function getPromptMemoryContext(state: InterviewState): PromptMemoryContext {
  // 1. Previous Questions Block (anti-repetition)
  const previousQuestionsBlock =
    state.askedQuestions.length > 0
      ? `\nPREVIOUS QUESTIONS ASKED IN THIS SESSION (DO NOT REPEAT):\n${state.askedQuestions
          .map((q, idx) => `  ${idx + 1}. "${q.replace(/\s+/g, " ").slice(0, 140)}..."`)
          .join("\n")}\n- STRICT RULE: Never repeat, re-ask, or closely rephrase any question from the list above. Always explore a fresh topic or deeper technical tradeoff.\n`
      : "";

  // 2. Candidate Memory Block (facts, skills, background)
  const mem = state.candidateMemory;
  const memoryLines: string[] = [];
  if (mem.experienceHighlights.length > 0) {
    memoryLines.push(`• Stated Experience: ${mem.experienceHighlights.join("; ")}`);
  }
  if (mem.skillsAndTechnologies.length > 0) {
    memoryLines.push(`• Mentioned Technologies/Tools: ${mem.skillsAndTechnologies.join(", ")}`);
  }
  if (mem.projectsAndArchitectures.length > 0) {
    memoryLines.push(`• Stated Projects/Concepts: ${mem.projectsAndArchitectures.join(", ")}`);
  }

  const candidateMemoryBlock =
    memoryLines.length > 0
      ? `\nCANDIDATE STATED BACKGROUND & FACTS (GROUNDING CONTEXT):\n${memoryLines.join("\n")}\n`
      : "";

  // 3. Topics Covered Block
  const topicsCoveredBlock =
    state.topicsCovered.length > 0
      ? `\nTOPICS TOUCHED SO FAR: ${state.topicsCovered.join(" | ")}\n`
      : "";

  // 4. Live Turn Directive
  let liveDirectiveBlock = `✅ LIVE TURN DIRECTIVE: SUBSTANTIVE RESPONSE\n- The candidate provided a genuine answer. Anchor to a specific detail, tool, or parameter they mentioned and probe deeper or challenge tradeoffs.`;

  if (state.isCandidateEnding) {
    liveDirectiveBlock = `🚨 LIVE TURN DIRECTIVE: CANDIDATE REQUESTED TO CONCLUDE SESSION
- The candidate explicitly requested to end, finish, or wrap up the interview.
- Warmly acknowledge their request, thank them for their time and technical discussion in 1-2 polite sentences.
- MANDATORY: You MUST append ${SESSION_END_TOKEN} at the very end of your response (e.g. "Thanks so much for your time today, and best of luck with next steps! ${SESSION_END_TOKEN}").
- DO NOT ask any further questions.`;
  } else if (state.isGreeting) {
    liveDirectiveBlock = `⚡ LIVE TURN DIRECTIVE: GREETING DETECTED
- The candidate sent a casual greeting/small talk ("hey", "hi", "how are you").
- Respond warmly in 1 short phrase (e.g. "Hey! Good to have you here.", "Hi there — hope you're doing well.").
- Immediately continue with the SAME question you were already asking.`;
  } else if (state.nonSubstantiveCount >= 2) {
    liveDirectiveBlock = `🚨 LIVE TURN DIRECTIVE: CONSECUTIVE NON-SUBSTANTIVE LIMIT REACHED (${state.nonSubstantiveCount} in a row)
- The candidate has given ${state.nonSubstantiveCount} non-substantive replies in a row without answering.
- DO NOT re-ask or loop on this topic. DO NOT repeat formulaic phrases.
- Release the topic naturally using varied phrasing (e.g. "All good, we can circle back to that later — let's look at...", "That's totally fine, moving over to...", "No problem at all — let's explore how you handle...", "Fair enough, leaving that aside, let's talk about...") and IMMEDIATELY pivot to a fresh question from another topic pillar.`;
  } else if (state.nonSubstantiveCount === 1) {
    liveDirectiveBlock = `⚠️ LIVE TURN DIRECTIVE: NON-SUBSTANTIVE INPUT (Count: 1)
- The candidate gave 1 minimal/filler reply ("fine"/"okay"/gibberish/evasive).
- DO NOT start with any affirmative opener ("Got it", "Understood", "Makes sense", "Right", "Fair point", "I see", "Okay").
- DO NOT advance to a new question yet.
- Patiently prompt for real substance using varied phrasing (e.g. "Take your time — walk me through how you'd approach that.", "I want to make sure I understand — could you say a bit more on that?", "Could you elaborate on the specific details or tools you'd use there?").`;
  } else if (state.isIntroTurn) {
    liveDirectiveBlock = `⚡ LIVE TURN DIRECTIVE: CANDIDATE INTRODUCTION TURN
- The candidate just shared their background and recent work.
- Acknowledge 1 specific project, technology, or domain they mentioned in 1 brief sentence (e.g. "Sounds like you've done substantial work with...", "Interesting background with...").
- DO NOT use AI clichés ("Awesome!", "Great background!", "Let's dive in!").
- Immediately ask your first opening question from Pillar 1, connecting it naturally to their background where possible.`;
  }

  return {
    previousQuestionsBlock,
    candidateMemoryBlock,
    topicsCoveredBlock,
    liveDirectiveBlock,
  };
}
