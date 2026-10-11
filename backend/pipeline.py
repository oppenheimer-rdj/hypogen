"""Core pipeline: retrieval, premise checking, experiment checks.

HONEST SCOPE: retrieval is TF-IDF (not MiniLM); the verifier is a lexical
BASELINE (overlap + contrast cues), not the trained neural verifier.
"""
import json
import math
import os
import re
import urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
STOP = set("a an the of and or to in on for with by is are was were be been it its this that these those as at from "
           "than then so we our can may not no do does did has have had which their there into over under more most "
           "such also when while using use used".split())
CONTRAST = ["however", "did not", "does not", "no improvement", "no gain", "fails", "failed", "worse", "hurt",
            "degrade", "unstable", "overfit", "not reliably", "no benefit", "declined", "but only"]

with open(os.path.join(HERE, "sample_corpus.json"), encoding="utf-8") as f:
    PASSAGES: list[dict] = json.load(f)


def tokens(text: str) -> list[str]:
    out = []
    for w in re.findall(r"[a-z0-9]+", text.lower()):
        if w in STOP or len(w) < 2:
            continue
        if w.endswith("s") and len(w) > 3:
            w = w[:-1]
        out.append(w)
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


def verify_premise(premise: str, source_id: str):
    """Lexical baseline verifier. Returns (label, evidence)."""
    evid = []
    for score, p in INDEX.search(premise, k=4, exclude={source_id}):
        if score < 0.12:
            continue
        contrast = any(c in p["text"].lower() for c in CONTRAST)
        evid.append({"id": p["id"], "paper": p["paper"], "page": p["page"], "text": p["text"],
                     "similarity": round(score, 2),
                     "relation": "contradicts" if contrast else "supports"})
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
        with urllib.request.urlopen(req, timeout=3) as r:  # short timeout: fail fast if Ollama is off
            out = json.loads(r.read())["response"].strip()
        out = re.sub(r"<think>.*?</think>", "", out, flags=re.S).strip()
        return out or None
    except Exception:
        return None


def run_pipeline(question: str, intervention: str, comparator: str, task: str,
                 metric: str, disconfirm: str) -> dict:
    hits = INDEX.search(question, k=6)
    if not hits:
        return {"error": "No relevant passages found in the corpus for this question."}

    llm = llm_prediction(question, hits)
    if llm:
        prediction, drafter = llm, "local LLM (Ollama)"
    else:
        prediction = (f"Under the same training budget, {intervention or 'the proposed method'} will change "
                      f"{metric or 'the chosen metric'} relative to {comparator or 'a baseline'}.")
        drafter = "template (no local LLM running)"

    premises = []
    for _, p in hits[:3]:
        quote = first_sentence(p["text"])
        label, evid = verify_premise(quote, p["id"])
        premises.append({"premise": quote,
                         "cited": {"id": p["id"], "paper": p["paper"], "page": p["page"]},
                         "citation_valid": quote in p["text"], "label": label, "evidence": evid})

    exp = {"intervention": intervention, "comparator": comparator, "task": task,
           "metric": metric, "disconfirming_outcome": disconfirm}
    missing = [k for k, v in exp.items() if not v.strip()]

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

    return {"error": None, "question": question, "drafter": drafter, "prediction": prediction,
            "assumption": "Findings from the cited passages transfer to the student's dataset and budget.",
            "premises": premises, "experiment": exp, "missing_fields": missing, "warnings": warnings,
            "retrieved": [{"id": p["id"], "paper": p["paper"], "page": p["page"], "score": round(s, 2),
                           "text": p["text"]} for s, p in hits]}


def add_paper(name: str, text: str) -> dict:
    global INDEX
    chunks = [c.strip() for c in re.split(r"\n\s*\n", text) if len(c.strip()) > 40] or [text.strip()]
    start = len(PASSAGES)
    for i, c in enumerate(chunks):
        PASSAGES.append({"id": f"U{start + i + 1}", "paper": name or "User paper", "page": 1, "text": c})
    INDEX = Index(PASSAGES)
    return {"added": len(chunks), "total": len(PASSAGES)}
