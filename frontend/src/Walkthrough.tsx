import { useEffect, useState } from "react";
import { WALKTHROUGH } from "./walkthrough";

interface Props {
  onClose: () => void;
  onTry: () => void;
}

export default function Walkthrough({ onClose, onTry }: Props) {
  const [i, setI] = useState(0);
  const last = WALKTHROUGH.length - 1;
  const s = WALKTHROUGH[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(last, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Walkthrough">
        <div className="modal-head">
          <span className="small">
            Walkthrough · step {i + 1} of {WALKTHROUGH.length}
          </span>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="dots">
          {WALKTHROUGH.map((_, k) => (
            <button key={k} className={k === i ? "dot on" : "dot"} onClick={() => setI(k)} aria-label={`Step ${k + 1}`} />
          ))}
        </div>
        <h2 className="modal-title">{s.title}</h2>
        <p className="lead">{s.what}</p>
        <div className="why">
          <b>Why it matters:</b> {s.why}
        </div>
        <div className="important">
          <b>Important:</b> {s.important}
        </div>
        <div className="small code-ref">
          Where in the code: <code>{s.code}</code>
        </div>
        <div className="modal-foot">
          <button className="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
            ← Back
          </button>
          {i < last ? (
            <button onClick={() => setI(i + 1)}>Next →</button>
          ) : (
            <button onClick={onTry}>Try it with the example question</button>
          )}
        </div>
      </div>
    </div>
  );
}
