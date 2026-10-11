import type { ReactNode } from "react";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Props {
  text: string;
  terms?: string[]; // words shared with the query (yellow)
  cues?: string[]; // conflict cue phrases (red)
}

/** Wraps matched words in <mark> so the key evidence stands out. */
export default function Highlight({ text, terms = [], cues = [] }: Props): ReactNode {
  const parts = [...cues, ...terms].filter(Boolean).sort((a, b) => b.length - a.length);
  if (parts.length === 0) return <>{text}</>;
  const re = new RegExp(`(${parts.map(escapeRe).join("|")})`, "gi");
  const cueSet = new Set(cues.map((c) => c.toLowerCase()));
  return (
    <>
      {text.split(re).map((seg, i) => {
        const low = seg.toLowerCase();
        if (cueSet.has(low)) return <mark key={i} className="cue">{seg}</mark>;
        if (terms.some((t) => t.toLowerCase() === low)) return <mark key={i}>{seg}</mark>;
        return <span key={i}>{seg}</span>;
      })}
    </>
  );
}
