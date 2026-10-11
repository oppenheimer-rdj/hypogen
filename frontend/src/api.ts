import type { HypothesisRequest, HypothesisResult, PaperResult } from "./types";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") msg = data.detail;
      else if (Array.isArray(data.detail)) msg = data.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch {
      /* keep default message */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const generateHypothesis = (req: HypothesisRequest) =>
  post<HypothesisResult>("/api/hypothesis", req);

export const addPaper = (name: string, text: string) =>
  post<PaperResult>("/api/paper", { name, text });
