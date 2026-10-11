export interface WalkStep {
  title: string;
  what: string;
  why: string;
  code: string;
  important: string;
}

export const EXAMPLE_QUESTION =
  "Does data augmentation or self-training help text classification when only a few labelled examples are available?";

export const WALKTHROUGH: WalkStep[] = [
  {
    title: "The problem this solves",
    what:
      "A student comparing papers has to separate what the papers actually show from what they assume, and then " +
      "decide what experiment to run. HYPOGEN suggests an experiment and shows the evidence for and against it, " +
      "with a citation on every claim.",
    why: "Language models often write convincing ideas with unsupported claims. Showing the evidence makes them checkable.",
    code: "Whole pipeline: backend/pipeline.py → run_pipeline()",
    important: "It is a research ASSISTANT. It never claims a discovery, and the researcher decides.",
  },
  {
    title: "1. Retrieve evidence",
    what:
      "Your question is compared against every stored passage using TF-IDF cosine similarity. The best matches are " +
      "returned with their score. Words shared with your question are highlighted in yellow.",
    why: "Every later step works only from these passages, so every claim can be traced to a paper and page.",
    code: "pipeline.py → Index.search()",
    important: "In the full design this uses MiniLM embeddings and PostgreSQL. The demo uses TF-IDF.",
  },
  {
    title: "2. Draft a prediction",
    what:
      "One untested prediction is written. If a local model (Ollama, e.g. Qwen3-1.7B) is running it drafts the " +
      "sentence; otherwise a template is filled with your intervention, comparator and metric.",
    why: "The prediction is kept separate from the facts so a guess is never shown as a finding.",
    code: "pipeline.py → llm_prediction()",
    important: "The page always states which one drafted it, so a template is never passed off as an LLM.",
  },
  {
    title: "3. Extract premises",
    what:
      "Each top passage contributes a factual premise (its lead sentence) and keeps its citation: paper, page and " +
      "passage ID. The code confirms the quoted sentence really appears in the stored passage.",
    why: "A citation is only useful if it points to text that exists. This check is automatic.",
    code: "pipeline.py → run_pipeline() step 3",
    important: "Citations are resolved from stored IDs by code, never trusted from model-written text.",
  },
  {
    title: "4. Verify each premise",
    what:
      "Each premise is searched against the OTHER passages. Every hit is labelled supporting or conflicting. " +
      "Conflicting means the passage contains cue words such as 'however', 'did not' or 'worse' (shown in red). " +
      "The premise gets one label: supports, contradicts, mixed or insufficient.",
    why: "This is the core idea: look for counter-evidence deliberately, and keep support and conflict separate.",
    code: "pipeline.py → verify_premise()",
    important:
      "This is a keyword-based BASELINE. The trained neural verifier (about 222k parameters, two evidence " +
      "channels) is the planned February work, and it is NOT built yet.",
  },
  {
    title: "5. Check the experiment plan",
    what:
      "The plan must name an intervention, a comparator, a task, a metric and a result that would disprove the " +
      "idea. Missing fields are flagged in red.",
    why: "An idea that cannot be disproved, or has no metric, cannot be tested.",
    code: "pipeline.py → run_pipeline() step 5",
    important: "Try clearing the 'disprove' field and send again to see the flag.",
  },
  {
    title: "6. Verdict, warnings, human decision",
    what:
      "Results are summarised into a verdict banner, warnings and next actions. The answer can be exported as a " +
      "Markdown report. The researcher decides whether to run the experiment.",
    why: "Evidence supporting the premises does not prove the new idea. Only an experiment does.",
    code: "pipeline.py → summarise()",
    important: "'No conflicting evidence found' means none in this small corpus. It does not mean the idea is novel or true.",
  },
  {
    title: "What is real, and what is planned",
    what:
      "Working now: retrieval, premise extraction with citations, conflict detection with the baseline checker, " +
      "experiment checks, evidence highlighting, export. Planned: PDF upload, MiniLM embeddings, PostgreSQL + " +
      "pgvector, the trained PyTorch verifier and its comparison against a simple baseline.",
    why: "Being clear about this protects the project's credibility.",
    code: "docs/PRESENTATION_GUIDE.md",
    important:
      "No accuracy numbers have been measured. Do not quote any until a real evaluation has been run.",
  },
];
