# HYPOGEN Demo

A small, runnable prototype of an evidence-checked hypothesis assistant.
Python standard library only. No installs, no internet needed.

## Run

    python app.py
    # open http://localhost:8000

Use `PORT=9000 python app.py` to change the port.

## What it does

1. Retrieves relevant passages for a research question (TF-IDF).
2. Drafts an untested prediction (template, or a local Ollama model if one is running).
3. Extracts factual premises and re-checks each against the *other* passages in the corpus.
4. Labels each premise: supports / contradicts / mixed / insufficient, with cited passage IDs and pages.
5. Checks the experiment plan for missing fields (intervention, comparator, task, metric, disconfirming outcome).
6. Shows warnings. The researcher decides.

You can paste your own paper text in the UI to add passages to the corpus.

## Honest scope

- Retrieval is TF-IDF, not MiniLM embeddings.
- The verifier is a **lexical baseline** (overlap plus contrast cues). It is NOT the trained neural verifier from the blueprint; it stands in so the whole pipeline can be shown working.
- Optional drafting: run Ollama with `qwen3:1.7b` (or set `OLLAMA_MODEL`).
- `sample_corpus.json` is illustrative text written for this demo, not quotes from real papers.
- No accuracy figures are claimed. None were measured.

## Planned next (see project blueprint)

FastAPI + PostgreSQL/pgvector, PDF ingestion with page provenance, MiniLM embeddings,
a PyTorch two-channel verifier trained from random weights, and a baseline comparison.
