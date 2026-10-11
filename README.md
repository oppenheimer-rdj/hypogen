# HYPOGEN Demo

Evidence-checked hypothesis assistant prototype.

- **Backend:** FastAPI + Pydantic (`backend/`)
- **Frontend:** React + TypeScript + Vite (`frontend/`)

## Run (two terminals)

Backend (Python 3.10+):

    cd backend
    python -m venv .venv
    .venv\Scripts\activate          # Windows   (macOS/Linux: source .venv/bin/activate)
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

API docs are at http://localhost:8000/docs

Frontend (Node 18+):

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173 (Vite proxies `/api` to the backend).

## What it does

1. Retrieves relevant passages for a research question (TF-IDF).
2. Drafts an untested prediction (template, or a local Ollama model if running).
3. Extracts factual premises and re-checks each against the *other* passages.
4. Labels each premise: supports / contradicts / mixed / insufficient, with passage ID and page.
5. Checks the experiment plan for missing fields.
6. Shows warnings. The researcher decides.

Paste your own paper text in the UI to add passages to the corpus.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Status and corpus size |
| `GET /api/corpus` | All stored passages |
| `POST /api/hypothesis` | Run retrieve, draft, check |
| `POST /api/paper` | Add pasted paper text as passages |

## Honest scope

- Retrieval is TF-IDF, not MiniLM embeddings.
- The verifier is a **lexical baseline** (overlap plus contrast cues). It is NOT the trained neural verifier from the blueprint; it stands in so the whole pipeline can be shown working.
- Optional drafting: run Ollama with `qwen3:1.7b` (or set `OLLAMA_MODEL`).
- `backend/sample_corpus.json` is illustrative text written for this demo, not quotes from real papers.
- No accuracy figures are claimed. None were measured.

## Planned next

PostgreSQL + pgvector, PDF ingestion with page provenance, MiniLM embeddings,
a PyTorch two-channel verifier trained from random weights, and a baseline comparison.
