export type Relation = "supports" | "contradicts";
export type PremiseLabel = "supports" | "contradicts" | "mixed" | "insufficient";
export type Severity = "good" | "caution" | "warning";

export interface ExperimentFields {
  intervention: string;
  comparator: string;
  task: string;
  metric: string;
  disconfirm: string;
}

export interface HypothesisRequest extends ExperimentFields {
  question: string;
}

export interface Evidence {
  id: string;
  paper: string;
  page: number;
  text: string;
  similarity: number;
  relation: Relation;
  matched: string[];
  cues: string[];
}

export interface Premise {
  premise: string;
  cited: { id: string; paper: string; page: number };
  citation_valid: boolean;
  label: PremiseLabel;
  evidence: Evidence[];
}

export interface Retrieved {
  id: string;
  paper: string;
  page: number;
  score: number;
  text: string;
  matched: string[];
}

export interface Step {
  name: string;
  detail: string;
  output: string;
  ms: number;
}

export interface Summary {
  severity: Severity;
  headline: string;
  counts: Record<PremiseLabel, number>;
  key_points: string[];
  next_actions: string[];
}

export interface HypothesisResult {
  question: string;
  drafter: string;
  prediction: string;
  assumption: string;
  premises: Premise[];
  experiment: Record<string, string>;
  missing_fields: string[];
  warnings: string[];
  steps: Step[];
  summary: Summary;
  retrieved: Retrieved[];
}

export interface PaperResult {
  added: number;
  total: number;
}

export interface PaperInfo {
  name: string;
  passages: { id: string; page: number; text: string }[];
}

export interface Msg {
  id: number;
  role: "user" | "assistant";
  text?: string;
  result?: HypothesisResult;
  error?: string;
  pending?: boolean;
}
