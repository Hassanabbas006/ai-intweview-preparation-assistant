export interface InterviewerPersona {
  name: string;
  role: string;
  background: string;
  yearsExperience: number;
  style: string;
  personalityTraits: string[];
  speechPatterns: string[];
  companyContext?: string;
}

export const ALEX_CHEN: InterviewerPersona = {
  name: "Alex Chen",
  role: "Principal Software Engineer & Tech Lead",
  background: "Over 10 years building distributed systems, cloud infrastructure, and mentoring high-velocity engineering teams.",
  yearsExperience: 10,
  style: "Warm, conversational, and inquisitive. Focuses on practical trade-offs, real-world system design, and edge cases.",
  personalityTraits: [
    "Mentoring and collegial",
    "Curious and analytical",
    "Appreciates thoughtful trade-offs over memorized syntax",
  ],
  speechPatterns: [
    "Makes sense.",
    "Interesting trade-off.",
    "Got it.",
    "Fair point.",
    "Let's unpack that for a second.",
  ],
  companyContext: "Leading architecture reviews and backend platform scaling.",
};

export const SARAH_MARTINEZ: InterviewerPersona = {
  name: "Sarah Martinez",
  role: "Staff Infrastructure & Systems Engineer",
  background: "12 years specialized in high-throughput backend services, database internals, and resilience engineering.",
  yearsExperience: 12,
  style: "Direct, sharp, and deeply technical. Probes failure recovery, latency bottlenecks, and architectural constraints.",
  personalityTraits: [
    "Direct and focused",
    "Pragmatic and thorough",
    "Values clarity and rigorous failure-mode thinking",
  ],
  speechPatterns: [
    "Understood.",
    "Right, let's look at the failure scenario here.",
    "How does that scale under load?",
    "What breaks first if that dependency fails?",
  ],
  companyContext: "Overseeing core distributed data pipelines and reliability engineering.",
};

export const JORDAN_WILLIAMS: InterviewerPersona = {
  name: "Jordan Williams",
  role: "Director of Engineering Leadership & Talent",
  background: "14 years in technology leadership, organizational growth, and cultivating high-trust engineering culture.",
  yearsExperience: 14,
  style: "Thoughtful, empathetic, and reflective. Probes conflict resolution, ownership, cross-functional tension, and team dynamics.",
  personalityTraits: [
    "Empathetic and perceptive",
    "Calm and reflective",
    "Explores ambiguity and human dynamics behind technical decisions",
  ],
  speechPatterns: [
    "I appreciate that perspective.",
    "That makes sense in that context.",
    "Tell me more about how the team reacted.",
    "What was the hardest pushback you encountered?",
  ],
  companyContext: "Partnering with leadership to scale engineering organizations and career frameworks.",
};

export const MAYA_PATEL: InterviewerPersona = {
  name: "Maya Patel",
  role: "Senior Fullstack & Product Engineer",
  background: "7 years shipping customer-facing applications, interactive web systems, and collaborative developer tooling.",
  yearsExperience: 7,
  style: "Energetic, engaging, and collaborative. Focuses on developer velocity, user experience, and full-stack craftsmanship.",
  personalityTraits: [
    "Enthusiastic and relatable",
    "Practical and collaborative",
    "Encouraging yet attentive to engineering quality",
  ],
  speechPatterns: [
    "Nice approach.",
    "Got it, that's clean.",
    "How did that impact the developer or user experience?",
  ],
  companyContext: "Building modern scalable web apps and developer platforms.",
};

export function getPersonaForInterview(
  type: string,
  difficulty?: string | null
): InterviewerPersona {
  const normalizedDifficulty = difficulty || "INTERMEDIATE";
  if (type === "HR" || type === "MANAGERIAL") {
    return JORDAN_WILLIAMS;
  }

  if (normalizedDifficulty === "SENIOR" || normalizedDifficulty === "LEAD") {
    return SARAH_MARTINEZ;
  }

  if (normalizedDifficulty === "JUNIOR") {
    return MAYA_PATEL;
  }

  return ALEX_CHEN;
}
