import { useState } from "react";
import { addPaper, generateHypothesis } from "./api";
import type { HypothesisRequest, HypothesisResult } from "./types";

const EXPERIMENT_KEYS = ["intervention", "comparator", "task", "metric", "disconfirming_outcome"];

const DEFAULTS: HypothesisRequest = {
  question:
    "Does data augmentation or self-training help text classification when only a few labelled examples are available?",
  intervention: "self-training with pseudo-labels",
  comparator: "plain supervised fine-tuning",
  task: "sentiment classification, 100 labelled examples",
  metric: "macro-F1 over 5 seeds",
  disconfirm: "no gain larger than seed-to-seed variance",
};

const STAGES = ["Retrieve", "Draft", "Check premises", "Check experiment", "Warn", "Researcher review"];

export default function App() {
  const [form, setForm] = useState<HypothesisRequest>(DEFAULTS);
  const [result, setResult] = useState<HypothesisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paperName, setPaperName] = useState("");
  const [paperText, setPaperText] = useState("");
  const [paperMsg, setPaperMsg] = useState("");

  const set = (k: keyof HypothesisRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await generateHypothesis(form));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAddPaper() {
    try {
      const r = await addPaper(paperName, paperText);
      setPaperMsg(`Added ${r.added} passage(s). Corpus size: ${r.total}`);
    } catch (e) {
      setPaperMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <header>
        <h1>HYPOGEN: evidence-checked hypothesis assistant</h1>
        <p>Demo prototype. FastAPI backend, React + TypeScript frontend.</p>
      </header>
      <main>
        <section>
          <div className="card">
            <h2>1. Research question</h2>
            <label>Question</label>
            <textarea value={form.question} onChange={set("question")} />
            <label>Intervention</label>
            <input value={form.intervention} onChange={set("intervention")} />
            <label>Comparator</label>
            <input value={form.comparator} onChange={set("comparator")} />
            <label>Dataset / task</label>
            <input value={form.task} onChange={set("task")} />
            <label>Metric</label>
            <input value={form.metric} onChange={set("metric")} />
            <label>What result would disprove it?</label>
            <input value={form.disconfirm} onChange={set("disconfirm")} />
            <button disabled={busy} onClick={run}>
              {busy ? "Working..." : "Generate and check"}
            </button>
          </div>
          <div className="card">
            <h2>Add your own paper text</h2>
            <label>Paper name</label>
            <input value={paperName} placeholder="e.g. My Paper (2025)" onChange={(e) => setPaperName(e.target.value)} />
            <label>Paste text (blank line between passages)</label>
            <textarea value={paperText} onChange={(e) => setPaperText(e.target.value)} />
            <button className="secondary" onClick={onAddPaper}>
              Add to corpus
            </button>
            <div className="small">{paperMsg}</div>
          </div>
          <div className="note">
            The checker is a lexical baseline standing in for the trained neural verifier. Retrieval is TF-IDF. Sample
            passages are illustrative, not quotes from real papers.
          </div>
        </section>

        <section>
          {error && <div className="card warn">{error}</div>}
          {!result && !error && (
            <div className="card">
              <div className="small">Results appear here.</div>
            </div>
          )}
          {result && <Results r={result} />}
        </section>
      </main>
    </>
  );
}

function Results({ r }: { r: HypothesisResult }) {
  return (
    <>
      <div className="stage">
        {STAGES.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>

      <div className="card">
        <h2>Candidate hypothesis</h2>
        <p>
          <b>Untested prediction:</b> {r.prediction}
        </p>
        <p className="small">Drafted by: {r.drafter}</p>
        <p>
          <b>Assumption:</b> {r.assumption}
        </p>
      </div>

      <div className="card">
        <h2>Factual premises and evidence</h2>
        {r.premises.map((p) => (
          <div className="premise" key={p.cited.id}>
            <span className={`badge ${p.label}`}>{p.label}</span> {p.premise}
            <div className="cite">
              cited: {p.cited.id} | {p.cited.paper} | p.{p.cited.page} | citation{" "}
              {p.citation_valid ? "resolves" : "INVALID"}
            </div>
            {p.evidence.length === 0 && <div className="ev">No other passage in this corpus bears on this premise.</div>}
            {p.evidence.map((e) => (
              <div className="ev" key={e.id}>
                <span className={`badge ${e.relation}`}>{e.relation}</span>{" "}
                <span className="cite">
                  {e.id} (sim {e.similarity})
                </span>{" "}
                {e.text}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Experiment plan</h2>
        {EXPERIMENT_KEYS.map((k) => (
          <div key={k}>
            <b>{k.replace("_", " ")}:</b>{" "}
            {r.experiment[k] ? r.experiment[k] : <span className="missing">MISSING</span>}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Warnings</h2>
        {r.warnings.map((w, i) => (
          <div className="warn" key={i}>
            {w}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Retrieved passages</h2>
        {r.retrieved.map((p) => (
          <div className="ev" key={p.id}>
            <span className="cite">
              {p.id} score {p.score} | {p.paper} p.{p.page}
            </span>{" "}
            {p.text}
          </div>
        ))}
      </div>
    </>
  );
}
