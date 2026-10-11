"""HYPOGEN demo: evidence-checked hypothesis drafting. Python standard library only.

Run:  python app.py   then open http://localhost:8000

HONEST SCOPE (say this in the presentation):
- Retrieval is TF-IDF, not MiniLM embeddings.
- The verifier is a lexical BASELINE (overlap + contrast cues), NOT the trained
  neural verifier. It stands in for it so the full pipeline can be shown working.
- Drafting uses a local Ollama model if one is running, otherwise a template.
- The sample corpus is illustrative text written for this demo, not quotes from papers.
"""
import json
import math
import os
import re
import urllib.request
from collections import Counter
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
STOP = set("a an the of and or to in on for with by is are was were be been it its this that these those as at from "
           "than then so we our can may not no do does did has have had which their there into over under more most "
           "such also when while using use used".split())
CONTRAST = ["however", "did not", "does not", "no improvement", "no gain", "fails", "failed", "worse", "hurt",
            "degrade", "unstable", "overfit", "not reliably", "no benefit", "declined", "but only"]


def load_corpus():
    with open(os.path.join(HERE, "sample_corpus.json"), encoding="utf-8") as f:
        return json.load(f)


PASSAGES = load_corpus()  # list of {id, paper, page, text}


def tokens(text):
    out = []
    for w in re.findall(r"[a-z0-9]+", text.lower()):
        if w in STOP or len(w) < 2:
            continue
        if w.endswith("s") and len(w) > 3:
            w = w[:-1]
        out.append(w)
    return out


class Index:
    def __init__(self, passages):
        self.passages = passages
        self.docs = [Counter(tokens(p["text"])) for p in passages]
        n = len(self.docs)
        df = Counter()
        for d in self.docs:
            df.update(d.keys())
        self.idf = {t: math.log((1 + n) / (1 + c)) + 1 for t, c in df.items()}
        self.vecs = [self._vec(d) for d in self.docs]

    def _vec(self, counter):
        v = {t: (1 + math.log(c)) * self.idf.get(t, 1.0) for t, c in counter.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {t: x / norm for t, x in v.items()}

    def search(self, query, k=5, exclude=None):
        q = self._vec(Counter(tokens(query)))
        scored = []
        for i, v in enumerate(self.vecs):
            if exclude and self.passages[i]["id"] in exclude:
                continue
            s = sum(w * v.get(t, 0.0) for t, w in q.items())
            scored.append((s, i))
        scored.sort(reverse=True)
        return [(s, self.passages[i]) for s, i in scored[:k] if s > 0]


INDEX = Index(PASSAGES)


def first_sentence(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())[0]


def verify_premise(premise, source_id):
    """Lexical baseline verifier. Returns label, evidence list, mixed flag."""
    hits = INDEX.search(premise, k=4, exclude={source_id})
    evid = []
    for score, p in hits:
        if score < 0.12:
            continue
        low = p["text"].lower()
        contrast = any(c in low for c in CONTRAST)
        rel = "contradicts" if contrast else "supports"
        evid.append({"id": p["id"], "paper": p["paper"], "page": p["page"], "text": p["text"],
                     "similarity": round(score, 2), "relation": rel})
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


def llm_prediction(question, passages):
    """Try a local Ollama model; return None if unavailable."""
    model = os.environ.get("OLLAMA_MODEL", "qwen3:1.7b")
    ctx = "\n".join(f"[{p['id']}] {p['text']}" for _, p in passages[:4])
    prompt = ("Using ONLY these passages, write one sentence stating an untested prediction a student could test "
              f"for the question: {question}\n\n{ctx}\n\nPrediction (one sentence):")
    body = json.dumps({"model": model, "prompt": prompt, "stream": False,
                       "options": {"num_predict": 80, "temperature": 0.3}}).encode()
    try:
        req = urllib.request.Request("http://localhost:11434/api/generate", body,
                                     {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            out = json.loads(r.read())["response"].strip()
        out = re.sub(r"<think>.*?</think>", "", out, flags=re.S).strip()
        return out or None
    except Exception:
        return None


def run_pipeline(data):
    question = data.get("question", "").strip()
    if not question:
        return {"error": "Enter a research question."}
    intervention = data.get("intervention", "").strip()
    comparator = data.get("comparator", "").strip()
    metric = data.get("metric", "").strip()
    task = data.get("task", "").strip()
    disconfirm = data.get("disconfirm", "").strip()

    hits = INDEX.search(question, k=6)
    if not hits:
        return {"error": "No relevant passages found in the corpus for this question.", "retrieved": []}

    llm = llm_prediction(question, hits)
    if llm:
        prediction, drafter = llm, "local LLM (Ollama)"
    else:
        a = intervention or "the proposed method"
        b = comparator or "a baseline"
        m = metric or "the chosen metric"
        prediction = f"Under the same training budget, {a} will change {m} relative to {b}."
        drafter = "template (no local LLM running)"

    premises = []
    for score, p in hits[:3]:
        quote = first_sentence(p["text"])
        label, evid = verify_premise(quote, p["id"])
        cite_ok = quote in p["text"]  # citation resolves to stored text
        premises.append({"premise": quote, "cited": {"id": p["id"], "paper": p["paper"], "page": p["page"]},
                         "citation_valid": cite_ok, "label": label, "evidence": evid})

    exp = {"intervention": intervention, "comparator": comparator, "task": task,
           "metric": metric, "disconfirming_outcome": disconfirm}
    missing = [k for k, v in exp.items() if not v]

    warnings = []
    for pr in premises:
        if pr["label"] == "insufficient":
            warnings.append(f"Premise cited to {pr['cited']['id']}: no other passage in this corpus supports it.")
        if pr["label"] in ("contradicts", "mixed"):
            warnings.append(f"Premise cited to {pr['cited']['id']}: conflicting evidence found. "
                            "Check whether datasets or settings differ.")
    if missing:
        warnings.append("Experiment plan is missing: " + ", ".join(missing) + ".")
    warnings.append("Absence of a similar idea in this small corpus does not mean the idea is novel.")

    return {"question": question, "drafter": drafter, "prediction": prediction,
            "assumption": "Findings from the cited passages transfer to the student's dataset and budget.",
            "premises": premises, "experiment": exp, "missing_fields": missing, "warnings": warnings,
            "retrieved": [{"id": p["id"], "paper": p["paper"], "page": p["page"], "score": round(s, 2),
                           "text": p["text"]} for s, p in hits]}


def add_paper(data):
    global INDEX
    name = data.get("name", "").strip() or "User paper"
    text = data.get("text", "").strip()
    if len(text) < 40:
        return {"error": "Paste at least a couple of sentences."}
    chunks = [c.strip() for c in re.split(r"\n\s*\n", text) if len(c.strip()) > 40] or [text]
    start = len(PASSAGES)
    for i, c in enumerate(chunks):
        PASSAGES.append({"id": f"U{start + i + 1}", "paper": name, "page": 1, "text": c})
    INDEX = Index(PASSAGES)
    return {"added": len(chunks), "total": len(PASSAGES)}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        raw = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            with open(os.path.join(HERE, "index.html"), "rb") as f:
                self._send(200, f.read(), "text/html; charset=utf-8")
        elif self.path == "/api/corpus":
            self._send(200, {"passages": PASSAGES})
        elif self.path == "/api/health":
            self._send(200, {"ok": True, "passages": len(PASSAGES)})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            return self._send(400, {"error": "bad json"})
        if self.path == "/api/hypothesis":
            self._send(200, run_pipeline(data))
        elif self.path == "/api/paper":
            self._send(200, add_paper(data))
        else:
            self._send(404, {"error": "not found"})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"HYPOGEN demo running at http://localhost:{port}  (Ctrl+C to stop)")
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
