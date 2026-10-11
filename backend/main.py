"""FastAPI backend for the HYPOGEN demo.

Run:  uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import pipeline

app = FastAPI(title="HYPOGEN Demo API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class HypothesisRequest(BaseModel):
    question: str = Field(min_length=3)
    intervention: str = ""
    comparator: str = ""
    task: str = ""
    metric: str = ""
    disconfirm: str = ""


class PaperRequest(BaseModel):
    name: str = ""
    text: str = Field(min_length=40)


@app.get("/api/health")
def health():
    return {"ok": True, "passages": len(pipeline.PASSAGES)}


@app.get("/api/corpus")
def corpus():
    return {"passages": pipeline.PASSAGES}


@app.post("/api/hypothesis")
def hypothesis(req: HypothesisRequest):
    result = pipeline.run_pipeline(req.question, req.intervention, req.comparator,
                                   req.task, req.metric, req.disconfirm)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.post("/api/paper")
def paper(req: PaperRequest):
    return pipeline.add_paper(req.name, req.text)
