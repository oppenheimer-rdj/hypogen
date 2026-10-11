import Highlight from "./Highlight";
import { downloadText, toMarkdown } from "./report";
import type { HypothesisResult, PremiseLabel } from "./types";

const EXPERIMENT_KEYS = ["intervention", "comparator", "task", "metric", "disconfirming_outcome"];
const LABEL_TEXT: Record<PremiseLabel, string> = {
  supports: "Supported",
  contradicts: "Contradicted",
  mixed: "Mixed evidence",
  insufficient: "No other evidence",
};
const SEVERITY_ICON = { good: "✓", caution: "!", warning: "⚠" } as const;

export default function Result({ r }: { r: HypothesisResult }) {
  const s = r.summary;
  return (
    <div className="result">
      {/* 1. Verdict: the most important information, first */}
      <div className={`verdict ${s.severity}`}>
        <div className="verdict-head">
          <span className="verdict-icon">{SEVERITY_ICON[s.severity]}</span>
          <strong>{s.headline}</strong>
        </div>
        <div className="chips">
          {(Object.keys(s.counts) as PremiseLabel[]).map((k) => (
            <span key={k} className={`chip ${k}`}>
              {s.counts[k]} {LABEL_TEXT[k].toLowerCase()}
            </span>
          ))}
        </div>
        <ul>
          {s.key_points.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      </div>

      {/* 2. The hypothesis, clearly labelled as not a finding */}
      <section className="block">
        <h3>Candidate hypothesis</h3>
        <div className="hyp">
          <span className="tag untested">UNTESTED PREDICTION · not a finding</span>
          <p className="prediction">{r.prediction}</p>
          <p className="small">Drafted by: {r.drafter}</p>
          <p>
            <b>Assumption:</b> {r.assumption}
          </p>
        </div>
      </section>

      {/* 3. Premises with evidence */}
      <section className="block">
        <h3>Factual premises and the evidence checked against them</h3>
        <p className="small">
          <mark>Yellow</mark> = words shared with the premise. <mark className="cue">Red</mark> = cue words that signal
          conflicting or qualified results.
        </p>
        {r.premises.map((p) => (
          <div className={`premise ${p.label}`} key={p.cited.id}>
            <div className="premise-head">
              <span className={`badge ${p.label}`}>{LABEL_TEXT[p.label]}</span>
              <span className="cite">
                {p.cited.id} · {p.cited.paper} · p.{p.cited.page} · {p.citation_valid ? "citation verified" : "CITATION INVALID"}
              </span>
            </div>
            <div className="premise-text">{p.premise}</div>
            {p.evidence.length === 0 && (
              <div className="ev none">No other passage in this corpus bears on this premise.</div>
            )}
            {p.evidence.map((e) => (
              <div className={`ev ${e.relation}`} key={e.id}>
                <div className="ev-head">
                  <span className={`badge small-badge ${e.relation}`}>
                    {e.relation === "supports" ? "supports" : "conflicts"}
                  </span>
                  <span className="cite">
                    {e.id} · {e.paper} · p.{e.page} · similarity {e.similarity}
                  </span>
                </div>
                <Highlight text={e.text} terms={e.matched} cues={e.cues} />
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* 4. Experiment checklist */}
      <section className="block">
        <h3>Experiment plan check</h3>
        <ul className="checklist">
          {EXPERIMENT_KEYS.map((k) => {
            const v = r.experiment[k];
            return (
              <li key={k} className={v ? "ok" : "bad"}>
                <span className="tick">{v ? "✓" : "✗"}</span>
                <b>{k.replace("_", " ")}:</b> {v || <span className="missing">MISSING. The idea is not testable yet.</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {/* 5. Warnings and actions */}
      <section className="block">
        <h3>Warnings</h3>
        {r.warnings.map((w, i) => (
          <div className="warn" key={i}>
            {w}
          </div>
        ))}
        <h3>Suggested next actions</h3>
        <ol className="actions">
          {s.next_actions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      </section>

      {/* 6. How it was produced: real step data and timings */}
      <details className="block how" open>
        <summary>How this answer was produced</summary>
        <ol className="timeline">
          {r.steps.map((st, i) => (
            <li key={st.name} style={{ animationDelay: `${i * 90}ms` }}>
              <div className="tl-head">
                <b>{st.name}</b>
                <span className="small">{st.ms} ms</span>
              </div>
              <div className="small">{st.detail}</div>
              <div className="tl-out">{st.output}</div>
            </li>
          ))}
        </ol>
      </details>

      <details className="block">
        <summary>All retrieved passages ({r.retrieved.length})</summary>
        {r.retrieved.map((p) => (
          <div className="ev" key={p.id}>
            <div className="cite">
              {p.id} · {p.paper} · p.{p.page} · score {p.score}
            </div>
            <Highlight text={p.text} terms={p.matched} />
          </div>
        ))}
      </details>

      <div className="actions-row">
        <button className="ghost" onClick={() => downloadText("hypogen-report.md", toMarkdown(r))}>
          ⬇ Export report (.md)
        </button>
      </div>
    </div>
  );
}
