export interface SubFocusOption {
  value: string;
  label: string;
}

export interface DomainOption {
  value: string;
  label: string;
  description?: string;
  subFocusOptions?: SubFocusOption[];
}

export const SOFTWARE_ENGINEERING_SUBFOCUS: SubFocusOption[] = [
  { value: "Fullstack", label: "Fullstack Engineering" },
  { value: "Frontend", label: "Frontend Engineering" },
  { value: "Backend", label: "Backend Engineering" },
  { value: "AI_ML", label: "AI & Machine Learning" },
  { value: "DevOps", label: "DevOps & Cloud Infrastructure" },
  { value: "Mobile", label: "Mobile (iOS / Android)" },
];

export const DOMAIN_OPTIONS: DomainOption[] = [
  {
    value: "Software_Engineering",
    label: "Software Engineering",
    description: "Fullstack, Frontend, Backend, AI/ML, DevOps, Mobile",
    subFocusOptions: SOFTWARE_ENGINEERING_SUBFOCUS,
  },
  {
    value: "Data_Science",
    label: "Data Science",
    description: "Statistical modeling, Machine Learning, Predictive analytics",
  },
  {
    value: "Data_Analytics",
    label: "Data Analytics",
    description: "SQL, Business Intelligence, ETL pipelines, Data visualization",
  },
  {
    value: "Cybersecurity",
    label: "Cybersecurity",
    description: "Security architecture, Threat modeling, Penetration testing, IAM",
  },
  {
    value: "Finance",
    label: "Finance",
    description: "Financial modeling, Valuation, Corporate finance, Capital markets",
  },
  {
    value: "Accounting",
    label: "Accounting",
    description: "Financial reporting, GAAP/IFRS, Auditing, Tax compliance",
  },
];

// All valid domain strings accepted by validation & database (with backward compatibility)
export const VALID_DOMAIN_VALUES = [
  "Software_Engineering",
  "Data_Science",
  "Data_Analytics",
  "Cybersecurity",
  "Finance",
  "Accounting",
  // Backward compatibility aliases
  "Frontend",
  "Backend",
  "Fullstack",
  "AI_ML",
  "DevOps",
  "Mobile",
] as [string, ...string[]];

export function getDomainLabel(value?: string | null): string {
  if (!value) return "Software Engineering";

  // Check core domains
  const core = DOMAIN_OPTIONS.find((d) => d.value === value);
  if (core) return core.label;

  // Check subfocus
  const sub = SOFTWARE_ENGINEERING_SUBFOCUS.find((s) => s.value === value);
  if (sub) return `Software Engineering (${sub.label})`;

  return value.replace(/_/g, " ");
}
