import { InterviewType } from "@prisma/client";
import { getDomainLabel } from "@/lib/constants/domains";
import { getPersonaForInterview } from "./personas";

export const SESSION_END_TOKEN = "[SESSION_COMPLETED]";

export interface BuildPromptParams {
  type: InterviewType;
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
 * Minimal fillers, short acknowledgments, and evasions
 */
const MINIMAL_FILLERS = new Set([
  "ok", "okay", "yes", "yeah", "yep", "sure", "alright", "all right", "got it",
  "k", "fine", "cool", "right", "understood", "true", "no", "nope", "yup", "nah",
  "good", "nice", "great", "thanks", "thank you", "thx", "ty", "done",
  "idk", "not sure", "no idea", "skip", "pass", "dunno", "nothing", "none",
  "no clue", "cant say", "can't say", "dont know", "don't know", "whatever",
  "maybe", "probably", "i guess", "guess so", "dont care", "don't care",
]);

const GREETINGS = new Set([
  "hi", "hey", "hello", "good morning", "good afternoon", "good evening",
  "how are you", "how are you doing", "hows it going", "how's it going",
  "whats up", "what's up", "hey there", "hi there", "hello there", "good day",
]);

/**
 * Checks if candidate explicitly asks to end, wrap up, or stop the interview session
 */
export function isCandidateRequestingToEnd(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  const endPatterns = [
    /\b(end|stop|finish|close|conclude|wrap up|wrap-up)\b.*\b(interview|session|round|here|call|meeting)\b/,
    /\b(let'?s|can we|i want to|i'd like to|could we)\b.*\b(wrap up|end|finish|stop|conclude)\b/,
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

export function classifyCandidateMessage(text: string): "GREETING" | "NON_SUBSTANTIVE" | "SUBSTANTIVE" {
  const normalized = text.trim().toLowerCase().replace(/^[.,!?;:]+|[.,!?;:]+$/g, "");
  if (!normalized) return "NON_SUBSTANTIVE";

  // Check greetings
  if (GREETINGS.has(normalized)) {
    return "GREETING";
  }

  // Check minimal fillers / evasions
  if (MINIMAL_FILLERS.has(normalized)) {
    return "NON_SUBSTANTIVE";
  }

  // Check gibberish
  if (isGibberish(normalized)) {
    return "NON_SUBSTANTIVE";
  }

  // Very short response (1-2 words under 12 characters total) with no technical substance
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && normalized.length < 12) {
    const knownShortTech = new Set([
      "sql", "css", "html", "aws", "gcp", "k8s", "rest", "grpc", "ci/cd", "vue",
      "react", "node", "redis", "kafka", "java", "rust", "go", "c++", "c#", "git",
      "bash", "nosql", "jwt", "tls", "ssl", "http", "graphql", "orm", "tdd", "bdd"
    ]);
    const hasTech = words.some((w) => knownShortTech.has(w));
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
  currentMessage: string
): { count: number; isGreeting: boolean } {
  const currentClassification = classifyCandidateMessage(currentMessage);
  if (currentClassification === "GREETING") {
    return { count: 0, isGreeting: true };
  }

  if (currentClassification === "SUBSTANTIVE") {
    return { count: 0, isGreeting: false };
  }

  // Current message is NON_SUBSTANTIVE (count starts at 1)
  let count = 1;

  // Walk backwards through previous user messages in history
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

export function buildSystemPrompt({
  type,
  domain,
  focusArea,
  difficulty = "INTERMEDIATE",
  consecutiveNonSubstantiveCount = 0,
  isGreeting = false,
  isIntroTurn = false,
  isCandidateEnding = false,
  previousQuestions = [],
}: BuildPromptParams): string {
  const persona = getPersonaForInterview(type, difficulty);
  const domainLabel = domain ? getDomainLabel(domain) : "Engineering";
  const focus = focusArea ? `with a specialized focus on "${focusArea}"` : "";

  const previousQuestionsSection =
    previousQuestions && previousQuestions.length > 0
      ? `\nPREVIOUS QUESTIONS ASKED IN THIS SESSION (DO NOT REPEAT):\n${previousQuestions
          .map((q, idx) => `  ${idx + 1}. "${q.replace(/\s+/g, " ").slice(0, 140)}..."`)
          .join("\n")}\n- STRICT RULE: Never repeat, re-ask, or closely rephrase any question from the list above. Always explore a fresh topic or deeper technical tradeoff.\n`
      : "";

  return `
You are ${persona.name}, ${persona.role} (${persona.yearsExperience} yrs exp).
Background: ${persona.background}
Style: ${persona.style}
${previousQuestionsSection}
${
  isCandidateEnding
    ? `🚨 LIVE TURN DIRECTIVE: CANDIDATE REQUESTED TO CONCLUDE SESSION
- The candidate explicitly requested to end, finish, or wrap up the interview.
- Warmly acknowledge their request, thank them for their time and technical discussion in 1-2 polite sentences.
- MANDATORY: You MUST append ${SESSION_END_TOKEN} at the very end of your response (e.g. "Thanks so much for your time today, and best of luck with next steps! ${SESSION_END_TOKEN}").
- DO NOT ask any further questions.`
    : isGreeting
    ? `⚡ LIVE TURN DIRECTIVE: GREETING DETECTED
- The candidate sent a casual greeting/small talk ("hey", "hi", "how are you").
- Respond warmly in 1 short phrase (e.g. "Hey! Good to have you here.", "Hi there — hope you're doing well.").
- Immediately continue with the SAME question you were already asking.`
    : consecutiveNonSubstantiveCount >= 2
    ? `🚨 LIVE TURN DIRECTIVE: CONSECUTIVE NON-SUBSTANTIVE LIMIT REACHED (${consecutiveNonSubstantiveCount} in a row)
- The candidate has given ${consecutiveNonSubstantiveCount} non-substantive replies in a row without answering.
- DO NOT re-ask or loop on this topic. DO NOT repeat formulaic phrases.
- Release the topic naturally using varied phrasing (e.g. "All good, we can circle back to that later — let's look at...", "That's totally fine, moving over to...", "No problem at all — let's explore how you handle...", "Fair enough, leaving that aside, let's talk about...") and IMMEDIATELY pivot to a fresh question from another topic pillar.`
    : consecutiveNonSubstantiveCount === 1
    ? `⚠️ LIVE TURN DIRECTIVE: NON-SUBSTANTIVE INPUT (Count: 1)
- The candidate gave 1 minimal/filler reply ("fine"/"okay"/gibberish/evasive).
- DO NOT start with any affirmative opener ("Got it", "Understood", "Makes sense", "Right", "Fair point", "I see", "Okay").
- DO NOT advance to a new question yet.
- Patiently prompt for real substance using varied phrasing (e.g. "Take your time — walk me through how you'd approach that.", "I want to make sure I understand — could you say a bit more on that?", "Could you elaborate on the specific details or tools you'd use there?").`
    : isIntroTurn
    ? `⚡ LIVE TURN DIRECTIVE: CANDIDATE INTRODUCTION TURN
- The candidate just shared their background and recent work.
- Acknowledge 1 specific project, technology, or domain they mentioned in 1 brief sentence (e.g. "Sounds like you've done substantial work with...", "Interesting background with...").
- DO NOT use AI clichés ("Awesome!", "Great background!", "Let's dive in!").
- Immediately ask your first opening question from Pillar 1, connecting it naturally to their background where possible.`
    : `✅ LIVE TURN DIRECTIVE: SUBSTANTIVE RESPONSE
- The candidate provided a genuine answer. Anchor to a specific detail, tool, or parameter they mentioned and probe deeper or challenge tradeoffs.`
}

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

export function buildOpeningPrompt({
  type,
  domain,
  focusArea,
  difficulty = "INTERMEDIATE",
}: BuildPromptParams): string {
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
