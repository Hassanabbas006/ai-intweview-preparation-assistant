export interface AptitudeQuestion {
  id: string;
  category: "Quantitative" | "Logical Reasoning" | "Verbal Ability";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const APTITUDE_QUESTION_BANK: AptitudeQuestion[] = [
  {
    id: "apt_1",
    category: "Quantitative",
    question:
      "A train running at a speed of 60 km/hr crosses a pole in 9 seconds. What is the length of the train?",
    options: ["120 metres", "150 metres", "180 metres", "324 metres"],
    correctIndex: 1,
    explanation:
      "Speed = 60 * (5/18) m/sec = 50/3 m/sec. Length of Train = Speed * Time = (50/3) * 9 = 150 metres.",
  },
  {
    id: "apt_2",
    category: "Quantitative",
    question:
      "If 12 men or 18 women can do a piece of work in 14 days, then how many days will 8 men and 16 women take to finish the same work?",
    options: ["8 days", "9 days", "10 days", "12 days"],
    correctIndex: 1,
    explanation:
      "12 Men = 18 Women => 1 Man = 1.5 Women. 8 Men + 16 Women = (8 * 1.5) + 16 = 28 Women. If 18 women take 14 days, 28 women will take (18 * 14) / 28 = 9 days.",
  },
  {
    id: "apt_3",
    category: "Quantitative",
    question:
      "A vendor bought bananas at 6 for Rs 10 and sold them at 4 for Rs 6. Find his loss percent.",
    options: ["10%", "15%", "20%", "25%"],
    correctIndex: 0,
    explanation:
      "Cost Price of 1 banana = 10/6 = Rs 5/3. Selling Price of 1 banana = 6/4 = Rs 3/2. Loss = (5/3) - (3/2) = 1/6. Loss % = (1/6) / (5/3) * 100 = 10%.",
  },
  {
    id: "apt_4",
    category: "Logical Reasoning",
    question:
      "Look at this series: 2, 1, (1/2), (1/4), ... What number should come next?",
    options: ["(1/3)", "(1/8)", "(2/8)", "(1/16)"],
    correctIndex: 1,
    explanation:
      "This is an alternating division series where each number is divided by 2 to get the next number: (1/4) / 2 = 1/8.",
  },
  {
    id: "apt_5",
    category: "Logical Reasoning",
    question:
      "Pointing to a photograph of a boy, Suresh said, 'He is the son of the only son of my mother.' How is Suresh related to that boy?",
    options: ["Brother", "Uncle", "Cousin", "Father"],
    correctIndex: 3,
    explanation:
      "The only son of Suresh's mother is Suresh himself. Therefore, the boy is the son of Suresh, which means Suresh is his Father.",
  },
  {
    id: "apt_6",
    category: "Logical Reasoning",
    question:
      "Statements: All mangoes are golden in colour. No golden-coloured things are cheap.\nConclusions:\nI. All mangoes are cheap.\nII. Golden-coloured mangoes are not cheap.",
    options: [
      "Only conclusion I follows",
      "Only conclusion II follows",
      "Either I or II follows",
      "Neither I nor II follows",
    ],
    correctIndex: 1,
    explanation:
      "Since all mangoes are golden and no golden things are cheap, mangoes are not cheap. Conclusion II directly follows.",
  },
  {
    id: "apt_7",
    category: "Verbal Ability",
    question:
      "Choose the word that is most nearly OPPOSITE in meaning to the word 'METICULOUS':",
    options: ["Careful", "Careless", "Painstaking", "Diligent"],
    correctIndex: 1,
    explanation:
      "'Meticulous' means showing great attention to detail or very careful and precise. The exact opposite is 'Careless'.",
  },
  {
    id: "apt_8",
    category: "Verbal Ability",
    question:
      "Select the correctly punctuated sentence with appropriate grammatical structure:",
    options: [
      "Although he worked hard, he could not succeed in the test.",
      "Although he worked hard but he could not succeed in the test.",
      "Although he worked hard; but he succeeded not.",
      "Although working hard he did not succeeded.",
    ],
    correctIndex: 0,
    explanation:
      "When a sentence begins with 'Although', it should not be followed by 'but' in the independent clause.",
  },
];

export function getAptitudeQuestions(count = 8): AptitudeQuestion[] {
  // Return the question bank (or shuffle if desired)
  return APTITUDE_QUESTION_BANK.slice(0, count);
}
