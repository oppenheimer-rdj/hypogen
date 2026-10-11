export type Relation = "supports" | "contradicts";
export type PremiseLabel = "supports" | "contradicts" | "mixed" | "insufficient";

export interface HypothesisRequest {
  question: string;
  intervention: string;
  comparator: string;
  task: string;
  metric: string;
  disconfirm: string;
}

export interface Evidence {
  id: string;
  paper: string;
  page: number;
  text: string;
  similarity: number;
  relation: Relation;
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
  retrieved: Retrieved[];
}

export interface PaperResult {
  added: number;
  total: number;
}
