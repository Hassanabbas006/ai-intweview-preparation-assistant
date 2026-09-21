export const DOMAIN_OPTIONS = [
  { value: "Frontend", label: "Frontend Engineering" },
  { value: "Backend", label: "Backend Engineering" },
  { value: "Fullstack", label: "Fullstack Engineering" },
  { value: "AI_ML", label: "AI & Machine Learning" },
  { value: "DevOps", label: "DevOps & Cloud" },
  { value: "Data_Science", label: "Data Science & Analytics" },
  { value: "Mobile", label: "Mobile (iOS / Android)" },
  { value: "Cybersecurity", label: "Cybersecurity" },
] as const;

export type DomainValue = (typeof DOMAIN_OPTIONS)[number]["value"];

export const VALID_DOMAIN_VALUES = DOMAIN_OPTIONS.map((d) => d.value) as [
  string,
  ...string[]
];
