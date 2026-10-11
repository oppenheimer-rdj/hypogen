"""Core pipeline: retrieval, premise checking, experiment checks.

HONEST SCOPE: retrieval is TF-IDF (not MiniLM); the verifier is a lexical
BASELINE (overlap + contrast cues), not the trained neural verifier.
"""
import json
import math
import os
import re
import time
import urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
STOP = set("a an the of and or to in on for with by is are was were be been it its this that these those as at from "
           "than then so we our can may not no do does did has have had which their there into over under more most "
           "such also when while using use used".split())
CONTRAST = ["however", "did not", "does not", "no improvement", "no gain", "fails", "failed", "worse", "hurt",
            "degrade", "unstable", "overfit", "not reliably", "no benefit", "declined", "but only"]

MIN_EVIDENCE_SIM = 0.2  # similarity needed before a passage counts as evidence for/against a premise

with open(os.path.join(HERE, "sample_corpus.json"), encoding="utf-8") as f:
    PASSAGES: list[dict] = json.load(f)


def stem(w: str) -> str:
    return w[:-1] if w.endswith("s") and len(w) > 3 else w


def tokens(text: str) -> list[str]:
    out = []
    for w in re.findall(r"[a-z0-9]+", text.lower()):
        if w in STOP or len(w) < 2:
            continue
        out.append(stem(w))
    return out


class Index:
    def __init__(self, passages: list[dict]):
        self.passages = passages
        docs = [Counter(tokens(p["text"])) for p in passages]
        n = len(docs)
        df: Counter = Counter()
        for d in docs:
            df.update(d.keys())
        self.idf = {t: math.log((1 + n) / (1 + c)) + 1 for t, c in df.items()}
        self.vecs = [self._vec(d) for d in docs]

    def _vec(self, counter: Counter) -> dict[str, float]:
        v = {t: (1 + math.log(c)) * self.idf.get(t, 1.0) for t, c in counter.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {t: x / norm for t, x in v.items()}

    def search(self, query: str, k: int = 5, exclude: set[str] | None = None):
        q = self._vec(Counter(tokens(query)))
        scored = []
        for i, v in enumerate(self.vecs):
            if exclude and self.passages[i]["id"] in exclude:
                continue
            scored.append((sum(w * v.get(t, 0.0) for t, w in q.items()), i))
        scored.sort(reverse=True)
        return [(s, self.passages[i]) for s, i in scored[:k] if s > 0]


INDEX = Index(PASSAGES)


def first_sentence(text: str) -> str:
    return re.split(r"(?<=[.!?])\s+", text.strip())[0]


def matched_words(query: str, text: str) -> list[str]:
    """Surface words in `text` that share a stem with the query (for highlighting)."""
    q = set(tokens(query))
    seen: list[str] = []
    for w in re.findall(r"[A-Za-z0-9][A-Za-z0-9\-]*", text):
        lw = w.lower()
        if lw not in STOP and stem(lw) in q and lw not in seen:
            seen.append(lw)
    return seen


def contrast_cues(text: str) -> list[str]:
    low = text.lower()
    return [c for c in CONTRAST if c in low]


def verify_premise(premise: str, source_id: str):
    """Lexical baseline verifier. Returns (label, evidence)."""
    evid = []
    for score, p in INDEX.search(premise, k=4, exclude={source_id}):
        if score < MIN_EVIDENCE_SIM:  # weakly related passages are ignored, not counted as evidence
            continue
        cues = contrast_cues(p["text"])
        evid.append({"id": p["id"], "paper": p["paper"], "page": p["page"], "text": p["text"],
                     "similarity": round(score, 2),
                     "relation": "contradicts" if cues else "supports",
                     "matched": matched_words(premise, p["text"]), "cues": cues})
    sup = [e for e in evid if e["relation"] == "supports"]
    con = [e for e in evid if e["relation"] == "contradicts"]
    if not evid:
        label = "insufficient"
    elif sup and con:
        label = "mixed"
    elif con:
        label = "contradicts"
    else:
        label = "supports"
    return label, evid


def llm_prediction(question: str, passages) -> str | None:
    """Optional local Ollama drafting; None if unavailable."""
    model = os.environ.get("OLLAMA_MODEL", "qwen3:1.7b")
    ctx = "\n".join(f"[{p['id']}] {p['text']}" for _, p in passages[:4])
    prompt = ("Using ONLY these passages, write one sentence stating an untested prediction a student could test "
              f"for the question: {question}\n\n{ctx}\n\nPrediction (one sentence):")
    body = json.dumps({"model": model, "prompt": prompt, "stream": False,
                       "options": {"num_predict": 80, "temperature": 0.3}}).encode()
    try:
        req = urllib.request.Request("http://localhost:11434/api/generate", body,
                                     {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as r:  # fail fast if Ollama is off
            out = json.loads(r.read())["response"].strip()
        out = re.sub(r"<think>.*?</think>", "", out, flags=re.S).strip()
        return out or None
    except Exception:
        return None


def summarise(premises: list[dict], missing: list[str]) -> dict:
    counts = Counter(p["label"] for p in premises)
    full = {k: counts.get(k, 0) for k in ("supports", "contradicts", "mixed", "insufficient")}
    n = len(premises)
    conflicted = full["contradicts"] + full["mixed"]
    key_points: list[str] = []
    actions: list[str] = []

    if conflicted:
        severity = "warning"
        headline = f"{conflicted} of {n} premises have conflicting evidence. Review before running this experiment."
        key_points.append("Other passages in the corpus disagree with, or qualify, these premises.")
        actions.append("Open the red evidence below and check whether dataset size, task or settings differ.")
    elif full["insufficient"]:
        severity = "caution"
        headline = f"{full['insufficient']} of {n} premises have no other supporting passage in this corpus."
        key_points.append("Missing evidence here means 'not found in this small corpus', not 'false'.")
        actions.append("Add more relevant papers in the sidebar and re-run.")
    else:
        severity = "good"
        headline = f"No conflicting evidence found for the {n} premises in this corpus."
        key_points.append("This does NOT show the prediction is true. The prediction is still untested.")

    key_points.append("The hypothesis is a suggestion to test, not a finding.")
    if missing:
        severity = "warning" if severity == "warning" else "caution"
        key_points.append("The experiment plan is incomplete: " + ", ".join(m.replace("_", " ") for m in missing) + ".")
        actions.append("Fill in the missing experiment fields so the idea is actually testable.")
    actions.append("Run the experiment with several random seeds before believing any gain.")
    return {"severity": severity, "headline": headline, "counts": full,
            "key_points": key_points, "next_actions": actions}


def run_pipeline(question: str, intervention: str, comparator: str, task: str,
                 metric: str, disconfirm: str) -> dict:
    steps: list[dict] = []

    def step(name: str, detail: str, output: str, t0: float):
        steps.append({"name": name, "detail": detail, "output": output,
                      "ms": round((time.perf_counter() - t0) * 1000, 1)})

    t = time.perf_counter()
    hits = INDEX.search(question, k=6)
    n_papers = len({p["paper"] for p in PASSAGES})
    if not hits:
        return {"error": "No relevant passages found in the corpus for this question."}
    step("1. Retrieve",
         f"Scored all {len(PASSAGES)} passages from {n_papers} papers by TF-IDF cosine similarity to your question.",
         "Top passages: " + ", ".join(f"{p['id']} ({s:.2f})" for s, p in hits), t)

    t = time.perf_counter()
    llm = llm_prediction(question, hits)
    if llm:
        prediction, drafter = llm, "local LLM (Ollama)"
    else:
        prediction = (f"Under the same training budget, {intervention or 'the proposed method'} will change "
                      f"{metric or 'the chosen metric'} relative to {comparator or 'a baseline'}.")
        drafter = "template (no local LLM running)"
    step("2. Draft prediction",
         "Wrote one untested prediction. Uses a local model if Ollama is running, otherwise a fill-in template.",
         f"Drafted by: {drafter}", t)

    t = time.perf_counter()
    premises = []
    for _, p in hits[:3]:
        quote = first_sentence(p["text"])
        premises.append({"premise": quote,
                         "cited": {"id": p["id"], "paper": p["paper"], "page": p["page"]},
                         "citation_valid": quote in p["text"], "label": "", "evidence": []})
    step("3. Extract premises",
         "Took the lead sentence of each top passage as a factual premise and kept its citation.",
         f"{len(premises)} premises; all citations resolve: "
         f"{all(p['citation_valid'] for p in premises)}", t)

    t = time.perf_counter()
    for pr in premises:
        pr["label"], pr["evidence"] = verify_premise(pr["premise"], pr["cited"]["id"])
    step("4. Verify premises",
         "Searched the OTHER passages for each premise, then labelled each hit as supporting or conflicting "
         "using overlap plus contrast cues (this is the baseline checker, not the trained neural model).",
         ", ".join(f"{p['cited']['id']}: {p['label']}" for p in premises), t)

    t = time.perf_counter()
    exp = {"intervention": intervention, "comparator": comparator, "task": task,
           "metric": metric, "disconfirming_outcome": disconfirm}
    missing = [k for k, v in exp.items() if not v.strip()]
    step("5. Check experiment plan",
         "Checked that the plan names an intervention, comparator, task, metric and a result that would disprove it.",
         "Complete" if not missing else "Missing: " + ", ".join(missing), t)

    t = time.perf_counter()
    warnings = []
    for pr in premises:
        cid = pr["cited"]["id"]
        if pr["label"] == "insufficient":
            warnings.append(f"Premise cited to {cid}: no other passage in this corpus supports it.")
        if pr["label"] in ("contradicts", "mixed"):
            warnings.append(f"Premise cited to {cid}: conflicting evidence found. "
                            "Check whether datasets or settings differ.")
    if missing:
        warnings.append("Experiment plan is missing: " + ", ".join(missing) + ".")
    warnings.append("Absence of a similar idea in this small corpus does not mean the idea is novel.")
    summary = summarise(premises, missing)
    step("6. Summarise and warn", "Turned the checks into a verdict, warnings and suggested next actions.",
         f"{len(warnings)} warnings; severity: {summary['severity']}", t)

    return {"error": None, "question": question, "drafter": drafter, "prediction": prediction,
            "assumption": "Findings from the cited passages transfer to the student's dataset and budget.",
            "premises": premises, "experiment": exp, "missing_fields": missing, "warnings": warnings,
            "steps": steps, "summary": summary,
            "retrieved": [{"id": p["id"], "paper": p["paper"], "page": p["page"], "score": round(s, 2),
                           "text": p["text"], "matched": matched_words(question, p["text"])} for s, p in hits]}


def list_papers() -> list[dict]:
    papers: dict[str, list[dict]] = {}
    for p in PASSAGES:
        papers.setdefault(p["paper"], []).append({"id": p["id"], "page": p["page"], "text": p["text"]})
    return [{"name": k, "passages": v} for k, v in papers.items()]


def add_paper(name: str, text: str) -> dict:
    global INDEX
    chunks = [c.strip() for c in re.split(r"\n\s*\n", text) if len(c.strip()) > 40] or [text.strip()]
    start = len(PASSAGES)
    for i, c in enumerate(chunks):
        PASSAGES.append({"id": f"U{start + i + 1}", "paper": name or "User paper", "page": 1, "text": c})
    INDEX = Index(PASSAGES)
    return {"added": len(chunks), "total": len(PASSAGES)}
