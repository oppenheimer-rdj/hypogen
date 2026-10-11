import type { HypothesisRequest, HypothesisResult, PaperInfo, PaperResult } from "./types";

async function parseError(res: Response): Promise<string> {
  let msg = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (typeof data.detail === "string") msg = data.detail;
    else if (Array.isArray(data.detail)) msg = data.detail.map((d: { msg: string }) => d.msg).join("; ");
  } catch {
    /* keep default message */
  }
  return msg;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export const generateHypothesis = (req: HypothesisRequest) =>
  post<HypothesisResult>("/api/hypothesis", req);

export const addPaper = (name: string, text: string) =>
  post<PaperResult>("/api/paper", { name, text });

export async function getPapers(): Promise<PaperInfo[]> {
  const res = await fetch("/api/papers");
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()).papers as PaperInfo[];
}
