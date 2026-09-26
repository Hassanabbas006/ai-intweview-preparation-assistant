export interface AptitudeQuestion {
  id: string;
  category: "Quantitative" | "Logical Reasoning" | "Verbal Ability";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const APTITUDE_QUESTION_BANK: AptitudeQuestion[] = [
  // ==========================================
  // QUANTITATIVE APTITUDE (20 Questions: apt_1 to apt_20)
  // ==========================================
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
      "If 12 men or 18 women can complete a project in 14 days, how many days will 8 men and 16 women take to finish the same project?",
    options: ["8 days", "9 days", "10 days", "12 days"],
    correctIndex: 1,
    explanation:
      "12 Men = 18 Women => 1 Man = 1.5 Women. 8 Men + 16 Women = (8 * 1.5) + 16 = 28 Women. If 18 women take 14 days, 28 women will take (18 * 14) / 28 = 9 days.",
  },
  {
    id: "apt_3",
    category: "Quantitative",
    question:
      "A vendor bought items at 6 for $10 and sold them at 4 for $6. Find the percentage loss.",
    options: ["10%", "15%", "20%", "25%"],
    correctIndex: 0,
    explanation:
      "Cost Price of 1 item = 10/6 = $5/3. Selling Price of 1 item = 6/4 = $3/2. Loss = (5/3) - (3/2) = 1/6. Loss % = ((1/6) / (5/3)) * 100 = 10%.",
  },
  {
    id: "apt_4",
    category: "Quantitative",
    question:
      "What is the difference between Compound Interest and Simple Interest on a principal of $5,000 for 2 years at an annual interest rate of 10%?",
    options: ["$25", "$50", "$75", "$100"],
    correctIndex: 1,
    explanation:
      "Difference for 2 years = P * (R / 100)^2 = 5000 * (10 / 100)^2 = 5000 * 0.01 = $50.",
  },
  {
    id: "apt_5",
    category: "Quantitative",
    question:
      "If Person A's salary is 25% more than Person B's salary, then Person B's salary is what percentage less than Person A's salary?",
    options: ["15%", "20%", "25%", "33.33%"],
    correctIndex: 1,
    explanation:
      "Let B's salary = $100. Then A's salary = $125. Difference = $25. Percentage less = (25 / 125) * 100 = 20%.",
  },
  {
    id: "apt_6",
    category: "Quantitative",
    question:
      "Two numbers are in the ratio 3 : 5. If 9 is subtracted from each, the new ratio becomes 12 : 23. What is the smaller number?",
    options: ["27", "33", "45", "55"],
    correctIndex: 1,
    explanation:
      "Let the numbers be 3x and 5x. (3x - 9) / (5x - 9) = 12 / 23 => 23(3x - 9) = 12(5x - 9) => 69x - 207 = 60x - 108 => 9x = 99 => x = 11. The smaller number is 3 * 11 = 33.",
  },
  {
    id: "apt_7",
    category: "Quantitative",
    question:
      "Two unbiased 6-sided dice are rolled simultaneously. What is the probability of getting a sum of exactly 8?",
    options: ["5/36", "1/6", "7/36", "1/4"],
    correctIndex: 0,
    explanation:
      "Total outcomes = 36. Pairs giving sum of 8: (2,6), (3,5), (4,4), (5,3), (6,2) = 5 outcomes. Probability = 5/36.",
  },
  {
    id: "apt_8",
    category: "Quantitative",
    question:
      "In how many distinct ways can the letters of the word 'LEADER' be arranged?",
    options: ["180", "360", "720", "1440"],
    correctIndex: 1,
    explanation:
      "The word 'LEADER' has 6 letters with 'E' repeating 2 times. Total permutations = 6! / 2! = 720 / 2 = 360.",
  },
  {
    id: "apt_9",
    category: "Quantitative",
    question:
      "Pipe A can fill a tank in 20 minutes and Pipe B can fill it in 30 minutes. If both pipes are opened simultaneously, how long will it take to fill the tank?",
    options: ["10 minutes", "12 minutes", "15 minutes", "25 minutes"],
    correctIndex: 1,
    explanation:
      "Combined 1-minute rate = (1/20) + (1/30) = (3 + 2) / 60 = 5/60 = 1/12. Time required = 12 minutes.",
  },
  {
    id: "apt_10",
    category: "Quantitative",
    question:
      "The average age of 24 students and their teacher is 15 years. If the teacher's age is excluded, the average age decreases by 1 year. What is the teacher's age?",
    options: ["35 years", "39 years", "40 years", "42 years"],
    correctIndex: 1,
    explanation:
      "Total age of 25 people = 25 * 15 = 375. Total age of 24 students = 24 * 14 = 336. Teacher's age = 375 - 336 = 39 years.",
  },
  {
    id: "apt_11",
    category: "Quantitative",
    question:
      "A boat can travel at a speed of 10 km/hr in still water. If the river speed is 2 km/hr, how long will the boat take to travel 24 km downstream and return 24 km upstream?",
    options: ["4 hours", "5 hours", "5.5 hours", "6 hours"],
    correctIndex: 1,
    explanation:
      "Downstream speed = 10 + 2 = 12 km/hr (Time = 24/12 = 2 hrs). Upstream speed = 10 - 2 = 8 km/hr (Time = 24/8 = 3 hrs). Total time = 2 + 3 = 5 hours.",
  },
  {
    id: "apt_12",
    category: "Quantitative",
    question:
      "The present ages of Alex and Ben are in the ratio 5 : 4. Three years hence, the ratio of their ages will become 11 : 9. What is Ben's present age?",
    options: ["20 years", "24 years", "28 years", "32 years"],
    correctIndex: 1,
    explanation:
      "Let ages be 5x and 4x. (5x + 3) / (4x + 3) = 11 / 9 => 9(5x + 3) = 11(4x + 3) => 45x + 27 = 44x + 33 => x = 6. Ben's present age = 4 * 6 = 24 years.",
  },
  {
    id: "apt_13",
    category: "Quantitative",
    question:
      "What is the smallest number which when divided by 6, 9, 12, 15, and 18 leaves a remainder of 2 in each case?",
    options: ["178", "180", "182", "362"],
    correctIndex: 2,
    explanation:
      "LCM of (6, 9, 12, 15, 18) = 180. The required number = LCM + Remainder = 180 + 2 = 182.",
  },
  {
    id: "apt_14",
    category: "Quantitative",
    question:
      "In what ratio must pure water be mixed with concentrated solution costing $12/litre to produce a diluted solution worth $9/litre?",
    options: ["1 : 3", "1 : 4", "3 : 4", "2 : 3"],
    correctIndex: 0,
    explanation:
      "By Alligation rule: Water cost = $0, Solution cost = $12, Mean price = $9. Ratio (Water : Solution) = (12 - 9) : (9 - 0) = 3 : 9 = 1 : 3.",
  },
  {
    id: "apt_15",
    category: "Quantitative",
    question:
      "The perimeter of a rectangular plot is 48 metres and its area is 108 square metres. What is the length of its longer side?",
    options: ["12 metres", "18 metres", "24 metres", "27 metres"],
    correctIndex: 1,
    explanation:
      "Perimeter = 2(l + w) = 48 => l + w = 24. Area = l * w = 108. The quadratic equation x^2 - 24x + 108 = 0 factors to (x - 18)(x - 6) = 0. Longer side = 18 metres.",
  },
  {
    id: "apt_16",
    category: "Quantitative",
    question:
      "A retailer marks product prices 40% above cost price and then allows a discount of 25% on the marked price. What is the retailer's net profit percentage?",
    options: ["5%", "10%", "15%", "20%"],
    correctIndex: 0,
    explanation:
      "Let Cost Price = $100. Marked Price = $140. Selling Price = 140 * (1 - 0.25) = $105. Net Profit = $105 - $100 = $5 (5%).",
  },
  {
    id: "apt_17",
    category: "Quantitative",
    question:
      "What is the acute angle between the hour hand and the minute hand of a clock at 3:40?",
    options: ["120°", "130°", "135°", "140°"],
    correctIndex: 1,
    explanation:
      "Angle = |30 * H - (11/2) * M| = |30 * 3 - (11/2) * 40| = |90 - 220| = |-130| = 130°.",
  },
  {
    id: "apt_18",
    category: "Quantitative",
    question:
      "In a group of 12 professionals, each person shakes hands with every other person exactly once. How many total handshakes occur?",
    options: ["60", "66", "72", "132"],
    correctIndex: 1,
    explanation:
      "Total handshakes = n * (n - 1) / 2 = 12 * 11 / 2 = 132 / 2 = 66 handshakes.",
  },
  {
    id: "apt_19",
    category: "Quantitative",
    question:
      "A single card is drawn from a standard, shuffled 52-card deck. What is the probability that the card drawn is either a King or a Heart?",
    options: ["4/13", "16/52", "17/52", "1/4"],
    correctIndex: 0,
    explanation:
      "Number of Kings = 4, Number of Hearts = 13, King of Hearts = 1 (overlapping). Favorable cards = 4 + 13 - 1 = 16. Probability = 16 / 52 = 4 / 13.",
  },
  {
    id: "apt_20",
    category: "Quantitative",
    question:
      "A car travels the first half of a distance at 40 km/hr and the second half of the distance at 60 km/hr. What is the average speed for the entire journey?",
    options: ["48 km/hr", "50 km/hr", "52 km/hr", "54 km/hr"],
    correctIndex: 0,
    explanation:
      "Harmonic mean average speed = (2 * v1 * v2) / (v1 + v2) = (2 * 40 * 60) / (40 + 60) = 4800 / 100 = 48 km/hr.",
  },

  // ==========================================
  // LOGICAL REASONING (20 Questions: apt_21 to apt_40)
  // ==========================================
  {
    id: "apt_21",
    category: "Logical Reasoning",
    question:
      "Look at this numerical sequence: 2, 1, (1/2), (1/4), ... What number should come next?",
    options: ["(1/3)", "(1/8)", "(2/8)", "(1/16)"],
    correctIndex: 1,
    explanation:
      "This is a division series where each term is divided by 2: (1/4) / 2 = 1/8.",
  },
  {
    id: "apt_22",
    category: "Logical Reasoning",
    question:
      "Pointing to a photograph of a boy, Suresh said, 'He is the son of the only son of my mother.' How is Suresh related to that boy?",
    options: ["Brother", "Uncle", "Cousin", "Father"],
    correctIndex: 3,
    explanation:
      "The only son of Suresh's mother is Suresh himself. Therefore, the boy is Suresh's son, making Suresh his Father.",
  },
  {
    id: "apt_23",
    category: "Logical Reasoning",
    question:
      "Statements: All mangoes are golden in colour. No golden-coloured items are cheap.\nConclusions:\nI. All mangoes are cheap.\nII. Golden-coloured mangoes are not cheap.",
    options: [
      "Only conclusion I follows",
      "Only conclusion II follows",
      "Either I or II follows",
      "Neither I nor II follows",
    ],
    correctIndex: 1,
    explanation:
      "Since all mangoes are golden and no golden items are cheap, mangoes cannot be cheap. Conclusion II directly follows.",
  },
  {
    id: "apt_24",
    category: "Logical Reasoning",
    question:
      "In a certain code, 'PENCIL' is written as 'QGODJM'. How would 'ERASER' be written in that same code?",
    options: ["FSBTFS", "FSBTFQ", "FTCVFS", "FQBTFS"],
    correctIndex: 0,
    explanation:
      "Each letter is shifted forward by +1 position in the alphabet: E->F, R->S, A->B, S->T, E->F, R->S => FSBTFS.",
  },
  {
    id: "apt_25",
    category: "Logical Reasoning",
    question:
      "A person walks 10 metres North, turns Right and walks 5 metres, then turns Right again and walks 10 metres. How far and in what direction is the person from the starting point?",
    options: ["5 metres East", "5 metres West", "10 metres North", "15 metres South"],
    correctIndex: 0,
    explanation:
      "Walking North 10m then South 10m cancels the vertical displacement. The horizontal displacement is 5m to the East.",
  },
  {
    id: "apt_26",
    category: "Logical Reasoning",
    question:
      "Identify the missing term in the sequence: SCD, TEF, UGH, ____, WKL",
    options: ["CMN", "UJI", "VIJ", "IJT"],
    correctIndex: 2,
    explanation:
      "First letters follow alphabetical order: S, T, U, V, W. Second letters: C, E, G, I, K (+2). Third letters: D, F, H, J, L (+2). The missing term is VIJ.",
  },
  {
    id: "apt_27",
    category: "Logical Reasoning",
    question:
      "Architect : Building :: Sculptor : ?",
    options: ["Museum", "Stone", "Statue", "Chisel"],
    correctIndex: 2,
    explanation:
      "An architect creates a building; a sculptor creates a statue. This represents a creator-to-creation relationship.",
  },
  {
    id: "apt_28",
    category: "Logical Reasoning",
    question:
      "Statement: 'Candidates applying for the Senior Engineer role must have at least 5 years of production experience.'\nAssumptions:\nI. The company values hands-on industry experience for this senior position.\nII. Applicants with less than 5 years of experience cannot write code.",
    options: [
      "Only assumption I is implicit",
      "Only assumption II is implicit",
      "Both I and II are implicit",
      "Neither I nor II is implicit",
    ],
    correctIndex: 0,
    explanation:
      "Assumption I directly underlies the requirement. Assumption II is extreme and not justified by the statement.",
  },
  {
    id: "apt_29",
    category: "Logical Reasoning",
    question:
      "Find the odd one out among the following numbers: 27, 64, 125, 144, 216",
    options: ["27", "64", "144", "216"],
    correctIndex: 2,
    explanation:
      "27 (3^3), 64 (4^3), 125 (5^3), and 216 (6^3) are perfect cubes. 144 is only a perfect square (12^2), not a cube.",
  },
  {
    id: "apt_30",
    category: "Logical Reasoning",
    question:
      "If 1st January 2024 was a Monday, what day of the week was 1st January 2025? (Note: 2024 is a leap year)",
    options: ["Tuesday", "Wednesday", "Thursday", "Sunday"],
    correctIndex: 1,
    explanation:
      "A leap year has 366 days = 52 weeks + 2 odd days. Adding 2 odd days to Monday gives Wednesday.",
  },
  {
    id: "apt_31",
    category: "Logical Reasoning",
    question:
      "Look at this sequence: 7, 10, 8, 11, 9, 12, ... What number should come next?",
    options: ["7", "10", "12", "13"],
    correctIndex: 1,
    explanation:
      "The pattern alternates: +3, -2, +3, -2, +3, -2. Following 12, subtract 2: 12 - 2 = 10.",
  },
  {
    id: "apt_32",
    category: "Logical Reasoning",
    question:
      "Statements: All software engineers use debuggers. Some software engineers write tests.\nConclusions:\nI. All test writers are software engineers.\nII. Some debugger users write tests.",
    options: [
      "Only conclusion I follows",
      "Only conclusion II follows",
      "Both I and II follow",
      "Neither follows",
    ],
    correctIndex: 1,
    explanation:
      "Since some engineers write tests and all engineers use debuggers, those engineers who write tests also use debuggers. Conclusion II follows.",
  },
  {
    id: "apt_33",
    category: "Logical Reasoning",
    question:
      "If A is the brother of B, B is the sister of C, and C is the father of D, how is A related to D?",
    options: ["Father", "Uncle", "Brother", "Grandfather"],
    correctIndex: 1,
    explanation:
      "A is the brother of C. Since C is the father of D, A is D's paternal uncle.",
  },
  {
    id: "apt_34",
    category: "Logical Reasoning",
    question:
      "If 3 * 4 = 25 and 4 * 5 = 41, then what is 5 * 6?",
    options: ["51", "56", "61", "65"],
    correctIndex: 2,
    explanation:
      "The rule is a^2 + b^2. 3^2 + 4^2 = 9 + 16 = 25. 4^2 + 5^2 = 16 + 25 = 41. 5^2 + 6^2 = 25 + 36 = 61.",
  },
  {
    id: "apt_35",
    category: "Logical Reasoning",
    question:
      "Oasis : Desert :: Island : ?",
    options: ["Mountain", "Ocean", "Forest", "Continent"],
    correctIndex: 1,
    explanation:
      "An oasis is a fertile body surrounded by desert; an island is a land mass surrounded by ocean.",
  },
  {
    id: "apt_36",
    category: "Logical Reasoning",
    question:
      "Event A: Heavy continuous rain flooded several primary transit highways.\nEvent B: City traffic authorities diverted commuter routes through arterial bypass roads.\nHow are these events related?",
    options: [
      "Event A is the cause and Event B is its effect",
      "Event B is the cause and Event A is its effect",
      "Both events are independent causes",
      "Both events are effects of independent causes",
    ],
    correctIndex: 0,
    explanation:
      "The highway flooding (Event A) directly caused the traffic authorities to implement route diversions (Event B).",
  },
  {
    id: "apt_37",
    category: "Logical Reasoning",
    question:
      "Five colleagues (P, Q, R, S, T) sit in a row facing North. R sits in the exact middle. P sits immediately to the left of Q. T is to the right of S. If P and Q sit to the left of R, who is at the leftmost end?",
    options: ["P", "Q", "S", "T"],
    correctIndex: 0,
    explanation:
      "Position slots 1 to 5: R is at 3. Left of R are slots 1 and 2. Since P is immediately left of Q, P must be at slot 1 (leftmost) and Q at slot 2.",
  },
  {
    id: "apt_38",
    category: "Logical Reasoning",
    question:
      "Rule: 'If the server CPU load exceeds 90%, an automated alert email is dispatched.'\nObservation: No automated alert email was dispatched.\nConclusion: The server CPU load did not exceed 90%.",
    options: [
      "Valid deductive conclusion (Modus Tollens)",
      "Invalid logic (Affirming the consequent)",
      "Inconclusive",
      "Fallacious assumption",
    ],
    correctIndex: 0,
    explanation:
      "If P -> Q, then not Q -> not P. This is standard, valid Modus Tollens deduction.",
  },
  {
    id: "apt_39",
    category: "Logical Reasoning",
    question:
      "Complete the analogy: Microscope : Magnify :: Telescope : ?",
    options: ["Focus", "View distant objects", "Reflect", "Illuminate"],
    correctIndex: 1,
    explanation:
      "A microscope's primary purpose is to magnify minute objects; a telescope's primary purpose is to view distant objects.",
  },
  {
    id: "apt_40",
    category: "Logical Reasoning",
    question:
      "In a code language, '134' means 'good and tasty', '478' means 'see good pictures', and '729' means 'pictures are faint'. Which digit stands for 'see'?",
    options: ["4", "7", "8", "9"],
    correctIndex: 2,
    explanation:
      "'4' is common between '134' and '478' ('good'). '7' is common between '478' and '729' ('pictures'). In '478', the remaining word is 'see' and digit is '8'.",
  },

  // ==========================================
  // VERBAL ABILITY (20 Questions: apt_41 to apt_60)
  // ==========================================
  {
    id: "apt_41",
    category: "Verbal Ability",
    question:
      "Choose the word that is most nearly OPPOSITE in meaning to 'METICULOUS':",
    options: ["Painstaking", "Careless", "Diligent", "Methodical"],
    correctIndex: 1,
    explanation:
      "'Meticulous' means showing great attention to detail or precision. Its direct antonym is 'Careless'.",
  },
  {
    id: "apt_42",
    category: "Verbal Ability",
    question:
      "Select the grammatically correct sentence:",
    options: [
      "Although he worked hard, he could not succeed in the test.",
      "Although he worked hard but he could not succeed in the test.",
      "Although he worked hard; but he succeeded not.",
      "Although working hard he did not succeeded.",
    ],
    correctIndex: 0,
    explanation:
      "When a subordinate clause begins with 'Although', it should not be followed by the coordinating conjunction 'but' in the main clause.",
  },
  {
    id: "apt_43",
    category: "Verbal Ability",
    question:
      "Choose the word that is closest in meaning to 'EPHEMERAL':",
    options: ["Eternal", "Transient", "Substantial", "Lethargic"],
    correctIndex: 1,
    explanation:
      "'Ephemeral' means lasting for a very short time. 'Transient' is its exact synonym.",
  },
  {
    id: "apt_44",
    category: "Verbal Ability",
    question:
      "What is the meaning of the idiom 'to burn the midnight oil'?",
    options: [
      "To waste energy on useless tasks",
      "To work or study late into the night",
      "To ignite a dispute among colleagues",
      "To operate machinery inefficiently",
    ],
    correctIndex: 1,
    explanation:
      "'To burn the midnight oil' means to work or study diligently late into the night.",
  },
  {
    id: "apt_45",
    category: "Verbal Ability",
    question:
      "Identify the segment containing a grammatical error:\n'Neither the engineering lead (A) / nor the developers (B) / was aware of the outage (C) / during the migration (D).'",
    options: ["Segment A", "Segment B", "Segment C", "Segment D"],
    correctIndex: 2,
    explanation:
      "When subjects are joined by 'neither... nor', the verb agrees with the closer subject. 'Developers' is plural, so it requires 'were aware', not 'was aware'.",
  },
  {
    id: "apt_46",
    category: "Verbal Ability",
    question:
      "Select the one-word substitution for: 'A person who knows and is able to use several different languages.'",
    options: ["Linguist", "Polyglot", "Philologist", "Orator"],
    correctIndex: 1,
    explanation:
      "A 'Polyglot' is a person who speaks, writes, or understands many languages.",
  },
  {
    id: "apt_47",
    category: "Verbal Ability",
    question:
      "Choose the most appropriate word to complete the sentence:\n'The executive gave a _______ presentation that eliminated all ambiguity regarding the project roadmap.'",
    options: ["lucid", "convoluted", "tentative", "specious"],
    correctIndex: 0,
    explanation:
      "'Lucid' means expressed clearly and easy to understand, perfectly matching the context of eliminating ambiguity.",
  },
  {
    id: "apt_48",
    category: "Verbal Ability",
    question:
      "Convert the active voice to passive voice:\n'The security team resolved the vulnerability yesterday.'",
    options: [
      "The vulnerability had been resolved by the security team yesterday.",
      "The vulnerability was resolved by the security team yesterday.",
      "The vulnerability is resolved by the security team yesterday.",
      "The vulnerability was being resolved by the security team yesterday.",
    ],
    correctIndex: 1,
    explanation:
      "Simple past active ('resolved') converts to simple past passive ('was resolved by').",
  },
  {
    id: "apt_49",
    category: "Verbal Ability",
    question:
      "Arrange the sentence fragments in coherent grammatical order:\n(P) for sustainable career growth\n(Q) continuous learning\n(R) and technical adaptability\n(S) are essential prerequisites",
    options: ["Q - R - S - P", "P - Q - R - S", "S - P - Q - R", "R - Q - P - S"],
    correctIndex: 0,
    explanation:
      "'Continuous learning (Q) and technical adaptability (R) are essential prerequisites (S) for sustainable career growth (P)' forms a fluent, logical sentence.",
  },
  {
    id: "apt_50",
    category: "Verbal Ability",
    question:
      "Choose the word that is most nearly OPPOSITE in meaning to 'PRAGMATIC':",
    options: ["Practical", "Realistic", "Idealistic", "Efficient"],
    correctIndex: 2,
    explanation:
      "'Pragmatic' means dealing with things sensibly and realistically based on practical considerations. 'Idealistic' is its antonym.",
  },
  {
    id: "apt_51",
    category: "Verbal Ability",
    question:
      "Choose the word that is closest in meaning to 'UBIQUITOUS':",
    options: ["Omnipresent", "Rare", "Equivocal", "Impermeable"],
    correctIndex: 0,
    explanation:
      "'Ubiquitous' means present, appearing, or found everywhere. 'Omnipresent' is its direct synonym.",
  },
  {
    id: "apt_52",
    category: "Verbal Ability",
    question:
      "Select the correct option to fill in the blank:\n'A collection of rare antique books _______ donated to the national library.'",
    options: ["were", "was", "have been", "are"],
    correctIndex: 1,
    explanation:
      "The head subject is 'A collection' (singular collective noun), which takes the singular verb 'was'.",
  },
  {
    id: "apt_53",
    category: "Verbal Ability",
    question:
      "Eloquent : Speech :: Graceful : ?",
    options: ["Movement", "Sound", "Texture", "Thought"],
    correctIndex: 0,
    explanation:
      "'Eloquent' describes high quality in speech; 'Graceful' describes high quality in movement.",
  },
  {
    id: "apt_54",
    category: "Verbal Ability",
    question:
      "Select the correct phrasing to improve the underlined portion:\n'He is *senior than me* in the engineering organization.'",
    options: [
      "senior to me",
      "more senior than I",
      "senior from me",
      "No improvement needed",
    ],
    correctIndex: 0,
    explanation:
      "Comparative adjectives derived from Latin ending in '-ior' (senior, junior, prior, superior) take 'to', not 'than'.",
  },
  {
    id: "apt_55",
    category: "Verbal Ability",
    question:
      "What is the meaning of the idiom 'a blessing in disguise'?",
    options: [
      "A fortunate event that appears misfortune at first",
      "A spiritual prayer offered anonymously",
      "A reward that carries hidden penalties",
      "An unexpected financial gift",
    ],
    correctIndex: 0,
    explanation:
      "'A blessing in disguise' refers to an apparent misfortune or setback that ultimately has positive or beneficial outcomes.",
  },
  {
    id: "apt_56",
    category: "Verbal Ability",
    question:
      "Choose the most fitting word:\n'Her arguments during the architecture review were so _______ that all stakeholders approved the proposal immediately.'",
    options: ["cogent", "redundant", "superficial", "diffuse"],
    correctIndex: 0,
    explanation:
      "'Cogent' means clear, logical, and convincing, which explains why the proposal was approved immediately.",
  },
  {
    id: "apt_57",
    category: "Verbal Ability",
    question:
      "Identify the correctly spelled word:",
    options: ["Accommodate", "Acommodate", "Accomodate", "Acomodate"],
    correctIndex: 0,
    explanation:
      "'Accommodate' is spelled with double 'c' and double 'm'.",
  },
  {
    id: "apt_58",
    category: "Verbal Ability",
    question:
      "Read the statement: 'While asynchronous communication enables schedule flexibility, without clear team conventions it frequently leads to misaligned expectations.'\nWhat is the main inference?",
    options: [
      "Asynchronous communication should be replaced by live meetings.",
      "Clear team conventions are crucial for effective asynchronous communication.",
      "Schedule flexibility is harmful to productivity.",
      "Misaligned expectations cannot be avoided in remote teams.",
    ],
    correctIndex: 1,
    explanation:
      "The statement asserts that the absence of clear conventions causes misalignment, implying that clear conventions are necessary.",
  },
  {
    id: "apt_59",
    category: "Verbal Ability",
    question:
      "Select the one-word substitution for: 'One who tends to see the worst aspect of things or believe that the worst will happen.'",
    options: ["Optimist", "Pessimist", "Altruist", "Pragmatist"],
    correctIndex: 1,
    explanation:
      "A 'Pessimist' is a person who habitually expects negative outcomes or focuses on the worst aspects of situations.",
  },
  {
    id: "apt_60",
    category: "Verbal Ability",
    question:
      "Select the sentence free of dangling modifiers or ambiguous construction:",
    options: [
      "Walking into the server room, the temperature felt freezing.",
      "While walking into the server room, the engineer noticed the freezing temperature.",
      "Having crashed unexpectedly, the engineer rebooted the database server.",
      "To optimize queries, the table indexes were deleted by mistake.",
    ],
    correctIndex: 1,
    explanation:
      "In option B, the introductory participial clause 'While walking into the server room' correctly modifies the subject 'the engineer'. In option A, the room didn't walk.",
  },
];

/**
 * Dynamically selects `count` questions (default 15) from the bank,
 * distributed evenly across Quantitative, Logical, and Verbal categories.
 * Prioritizes questions that the candidate has not seen in recent attempts.
 */
export function selectAptitudeQuestions(
  excludeIds: string[] = [],
  count = 15
): AptitudeQuestion[] {
  const excludeSet = new Set(excludeIds);

  const quantPool = APTITUDE_QUESTION_BANK.filter((q) => q.category === "Quantitative");
  const logicPool = APTITUDE_QUESTION_BANK.filter((q) => q.category === "Logical Reasoning");
  const verbalPool = APTITUDE_QUESTION_BANK.filter((q) => q.category === "Verbal Ability");

  const perCategory = Math.floor(count / 3);
  const remainder = count % 3;

  function pickFromCategory(pool: AptitudeQuestion[], targetCount: number): AptitudeQuestion[] {
    // Unseen questions from recent attempts
    const unseen = pool.filter((q) => !excludeSet.has(q.id));
    const shuffledUnseen = [...unseen].sort(() => Math.random() - 0.5);

    if (shuffledUnseen.length >= targetCount) {
      return shuffledUnseen.slice(0, targetCount);
    }

    // Backfill from previously seen questions if candidate exhausted fresh pool
    const seen = pool.filter((q) => excludeSet.has(q.id));
    const shuffledSeen = [...seen].sort(() => Math.random() - 0.5);
    const combined = [...shuffledUnseen, ...shuffledSeen];
    return combined.slice(0, targetCount);
  }

  const selectedQuant = pickFromCategory(quantPool, perCategory + (remainder > 0 ? 1 : 0));
  const selectedLogic = pickFromCategory(logicPool, perCategory + (remainder > 1 ? 1 : 0));
  const selectedVerbal = pickFromCategory(verbalPool, perCategory);

  const allSelected = [...selectedQuant, ...selectedLogic, ...selectedVerbal];

  // Interleave and randomize question presentation order
  return allSelected.sort(() => Math.random() - 0.5);
}

/**
 * Retrieves specific questions in the specified ID order.
 */
export function getQuestionsByIds(ids: string[]): AptitudeQuestion[] {
  const idMap = new Map(APTITUDE_QUESTION_BANK.map((q) => [q.id, q]));
  const result: AptitudeQuestion[] = [];
  for (const id of ids) {
    const q = idMap.get(id);
    if (q) result.push(q);
  }
  return result;
}

/**
 * Default fallback question retriever
 */
export function getAptitudeQuestions(count = 15): AptitudeQuestion[] {
  return selectAptitudeQuestions([], count);
}
