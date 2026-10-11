import { useCallback, useEffect, useRef, useState } from "react";
import { generateHypothesis, getPapers } from "./api";
import Result from "./Result";
import Sidebar from "./Sidebar";
import Walkthrough from "./Walkthrough";
import { EXAMPLE_QUESTION } from "./walkthroughData";
import type { ExperimentFields, Msg, PaperInfo } from "./types";

const DEFAULT_FIELDS: ExperimentFields = {
  intervention: "self-training with pseudo-labels",
  comparator: "plain supervised fine-tuning",
  task: "sentiment classification, 100 labelled examples",
  metric: "macro-F1 over 5 seeds",
  disconfirm: "no gain larger than seed-to-seed variance",
};

const FIELD_LABELS: Record<keyof ExperimentFields, string> = {
  intervention: "Intervention (what you change)",
  comparator: "Comparator (what you compare against)",
  task: "Dataset / task",
  metric: "Metric",
  disconfirm: "What result would disprove it?",
};

const EXAMPLES = [
  EXAMPLE_QUESTION,
  "Is few-shot fine-tuning reliable across random seeds?",
  "How should I compare low-resource text classification methods fairly?",
];

let nextId = 1;

export default function App() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [papers, setPapers] = useState<PaperInfo[]>([]);
  const [input, setInput] = useState("");
  const [fields, setFields] = useState<ExperimentFields>(DEFAULT_FIELDS);
  const [showFields, setShowFields] = useState(false);
  const [showWalk, setShowWalk] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const refreshPapers = useCallback(() => {
    getPapers()
      .then((p) => {
        setPapers(p);
        setBackendDown(false);
      })
      .catch(() => setBackendDown(true));
  }, []);

  useEffect(refreshPapers, [refreshPapers]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const busy = msgs.some((m) => m.pending);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const userId = nextId++;
    const botId = nextId++;
    setInput("");
    setMsgs((m) => [...m, { id: userId, role: "user", text: q }, { id: botId, role: "assistant", pending: true }]);
    try {
      const result = await generateHypothesis({ question: q, ...fields });
      setMsgs((m) => m.map((x) => (x.id === botId ? { id: botId, role: "assistant", result } : x)));
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setMsgs((m) => m.map((x) => (x.id === botId ? { id: botId, role: "assistant", error } : x)));
    }
  }

  const setField = (k: keyof ExperimentFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields({ ...fields, [k]: e.target.value });

  const missingCount = Object.values(fields).filter((v) => !v.trim()).length;

  return (
    <div className="app">
      <Sidebar
        papers={papers}
        onChanged={refreshPapers}
        onNew={() => setMsgs([])}
        onWalkthrough={() => setShowWalk(true)}
      />

      <div className="main">
        <div className="honesty">
          <b>Demo mode:</b> keyword-based checker, TF-IDF retrieval, illustrative sample papers. The trained neural
          verifier is planned work. No accuracy figures are claimed.
        </div>
        {backendDown && (
          <div className="banner-err">
            Cannot reach the backend. Start it with <code>uvicorn main:app --port 8000</code> inside the backend folder.
          </div>
        )}

        <div className="thread">
          {msgs.length === 0 && (
            <div className="empty">
              <h1>What do you want to investigate?</h1>
              <p>
                Ask a research question. HYPOGEN retrieves evidence, drafts an <b>untested</b> prediction, checks each
                premise for <b>supporting and conflicting</b> passages, and tells you what is missing.
              </p>
              <div className="examples">
                {EXAMPLES.map((e) => (
                  <button key={e} className="example" onClick={() => send(e)}>
                    {e}
                  </button>
                ))}
              </div>
              <button className="ghost" onClick={() => setShowWalk(true)}>
                ▶ Take the 2-minute walkthrough
              </button>
            </div>
          )}

          {msgs.map((m) =>
            m.role === "user" ? (
              <div className="bubble user" key={m.id}>
                {m.text}
              </div>
            ) : (
              <div className="assistant" key={m.id}>
                <div className="avatar">H</div>
                <div className="a-body">
                  {m.pending && <div className="thinking">Retrieving evidence and checking premises…</div>}
                  {m.error && <div className="banner-err">{m.error}</div>}
                  {m.result && <Result r={m.result} />}
                </div>
              </div>
            )
          )}
          <div ref={bottom} />
        </div>

        <div className="composer">
          {showFields && (
            <div className="fields">
              {(Object.keys(FIELD_LABELS) as (keyof ExperimentFields)[]).map((k) => (
                <label key={k}>
                  {FIELD_LABELS[k]}
                  <input value={fields[k]} onChange={setField(k)} />
                </label>
              ))}
            </div>
          )}
          <div className="input-row">
            <textarea
              value={input}
              placeholder="Ask a research question…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button disabled={busy || !input.trim()} onClick={() => send(input)}>
              {busy ? "Working…" : "Send"}
            </button>
          </div>
          <div className="composer-foot">
            <button className="link" onClick={() => setShowFields(!showFields)}>
              {showFields ? "Hide" : "Edit"} experiment details
            </button>
            {missingCount > 0 && <span className="missing"> · {missingCount} field(s) empty, will be flagged</span>}
          </div>
        </div>
      </div>

      {showWalk && (
        <Walkthrough
          onClose={() => setShowWalk(false)}
          onTry={() => {
            setShowWalk(false);
            send(EXAMPLE_QUESTION);
          }}
        />
      )}
    </div>
  );
}
