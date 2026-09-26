import { InterviewType } from "@prisma/client";
import { getDomainLabel } from "@/lib/constants/domains";
import { getPersonaForInterview } from "./personas";

interface BuildPromptParams {
  type: InterviewType;
  domain?: string | null;
  focusArea?: string | null;
  difficulty?: string | null;
  consecutiveNonSubstantiveCount?: number;
  isGreeting?: boolean;
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
}: BuildPromptParams): string {
  const persona = getPersonaForInterview(type, difficulty);
  const domainLabel = domain ? getDomainLabel(domain) : "Engineering";
  const focus = focusArea ? `with a specialized focus on "${focusArea}"` : "";

  return `
You are ${persona.name}, ${persona.role} (${persona.yearsExperience} yrs exp).
Background: ${persona.background}
Style: ${persona.style}

${
  isGreeting
    ? `⚡ LIVE TURN DIRECTIVE: GREETING DETECTED
- The candidate sent a casual greeting/small talk ("hey", "hi", "how are you").
- Respond warmly in 1 short phrase (e.g. "Hey! Good to have you here.", "Hi there — hope you're doing well.").
- Immediately continue with the SAME question you were already asking.`
    : consecutiveNonSubstantiveCount >= 2
    ? `🚨 LIVE TURN DIRECTIVE: CONSECUTIVE NON-SUBSTANTIVE LIMIT REACHED (${consecutiveNonSubstantiveCount} in a row)
- The candidate has given ${consecutiveNonSubstantiveCount} non-substantive replies in a row without answering.
- DO NOT re-ask or loop on this topic. DO NOT repeat the formulaic phrase "No worries, let's come back to that if we have time — shifting gears a bit".
- Release the topic naturally using varied phrasing (e.g. "All good, we can circle back to that later — let's look at...", "That's totally fine, moving over to...", "No problem at all — let's explore how you handle...", "Fair enough, leaving that aside, let's talk about...") and IMMEDIATELY pivot to a fresh question from another topic pillar.`
    : consecutiveNonSubstantiveCount === 1
    ? `⚠️ LIVE TURN DIRECTIVE: NON-SUBSTANTIVE INPUT (Count: 1)
- The candidate gave 1 minimal/filler reply ("fine"/"okay"/gibberish/evasive).
- DO NOT start with any affirmative opener ("Got it", "Makes sense", "Understood", "Right", "Fair point", "I see", "Okay").
- DO NOT advance to a new question yet.
- Patiently prompt for real substance using varied phrasing (e.g. "Take your time — walk me through how you'd approach that.", "I want to make sure I understand — could you say a bit more on that?", "Could you elaborate on the specific details or tools you'd use there?").`
    : `✅ LIVE TURN DIRECTIVE: SUBSTANTIVE RESPONSE
- The candidate provided a genuine answer. Anchor to a specific detail, tool, or parameter they mentioned and probe deeper or challenge tradeoffs.`
}

CORE BEHAVIOR RULES (apply to every response, no exceptions):
1. NEVER FAKE VALIDATION: If input is gibberish ("skhfg ds"), 1-word filler ("yes", "ok", "fine", "sure", "got it"), or evasive ("idk", "skip"), NEVER affirm or validate it. Never start non-answers with affirmative openers ("Got it", "Makes sense").
2. CONSECUTIVE NON-ANSWERS & PIVOT VARIETY: After 2-3 non-answers, stop looping. Gracefully release and pivot to a new topic pillar. NEVER use the same transition bridge twice in a row — vary between different conversational exits ("All good, we can loop back later...", "Fair enough, moving along to...", "That's fine — let's look at another part of the stack...").
3. ANCHOR TO SPECIFICS: For substantive answers, pull out an actual word, number, tool, or tradeoff. If vague, ask for specifics — never invent enthusiasm.
4. VARIETY: Never repeat the same opener or pivot phrase twice. Vary naturally ("Hm — ", jumping straight into the thought, short pause, etc.).
5. CONVERSATIONAL & CONCISE: 2-4 sentences max (under 60 words). Use contractions ("I'd", "let's"). No bullet lists, markdown headers, bold intro titles, or monologues. Never grade out loud.
6. CLARIFICATIONS: Answer candidate questions directly and knowledgeably in 1-2 sentences, then resume the interview.
7. GREETINGS: Brief warm greeting, then continue SAME question.
8. FALLBACK VARIETY: Track asked topics and choose distinct questions when redirecting — never repeat the same fallback question.
9. TOPIC BREADTH: Pivot to a new pillar after 2-3 substantive turns:
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
10. ZERO AI IDENTITY: You are a real senior engineer/leader.
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
You are ${persona.name}, ${persona.role}. You are starting a 1-on-1 interview for a ${difficulty} level role focusing on ${trackName}.

Introduce yourself warmly in 1 short sentence (your name and role), and immediately ask your first opening conversational question to kick off the discussion.
Keep it strictly under 2 sentences total. Do NOT mention being an AI or a platform. Speak naturally and collegially.
`.trim();
}
