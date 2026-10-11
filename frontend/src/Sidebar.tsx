import { useState } from "react";
import { addPaper } from "./api";
import type { PaperInfo } from "./types";

interface Props {
  papers: PaperInfo[];
  onChanged: () => void;
  onNew: () => void;
  onWalkthrough: () => void;
}

export default function Sidebar({ papers, onChanged, onNew, onWalkthrough }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const total = papers.reduce((n, p) => n + p.passages.length, 0);

  async function submit() {
    try {
      const r = await addPaper(name, text);
      setMsg(`Added ${r.added} passage(s).`);
      setName("");
      setText("");
      setAdding(false);
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logo">H</span>
        <div>
          <div className="brand-name">HYPOGEN</div>
          <div className="small">Research assistant · demo</div>
        </div>
      </div>

      <button className="new" onClick={onNew}>
        + New research chat
      </button>
      <button className="ghost wide" onClick={onWalkthrough}>
        ▶ How it works (walkthrough)
      </button>

      <div className="side-title">
        Library <span className="count">{papers.length} papers · {total} passages</span>
      </div>
      <div className="paper-list">
        {papers.map((p) => (
          <details key={p.name} className="paper">
            <summary>
              {p.name} <span className="count">{p.passages.length}</span>
            </summary>
            {p.passages.map((x) => (
              <div className="passage" key={x.id}>
                <span className="cite">
                  {x.id} · p.{x.page}
                </span>
                <div>{x.text}</div>
              </div>
            ))}
          </details>
        ))}
      </div>

      {adding ? (
        <div className="add-box">
          <input value={name} placeholder="Paper name" onChange={(e) => setName(e.target.value)} />
          <textarea
            value={text}
            placeholder="Paste text. A blank line starts a new passage."
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row">
            <button onClick={submit}>Add</button>
            <button className="ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="ghost wide" onClick={() => setAdding(true)}>
          + Add paper text
        </button>
      )}
      {msg && <div className="small">{msg}</div>}

      <div className="side-note">
        <b>Demo status</b>
        <br />
        Checker: keyword baseline
        <br />
        Retrieval: TF-IDF
        <br />
        Corpus: illustrative samples
      </div>
    </aside>
  );
}
