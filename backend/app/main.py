from __future__ import annotations

import base64
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles

from . import services
from .config import CHART_DIR
from .database import init_db
from .llm import configured as llm_configured

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("scholarflow")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="ScholarFlow Research Tool API",
    description="Project-state, literature, evidence, analysis and writing tools designed for orchestration by a Nankai GeniOS Agent.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/api/charts", StaticFiles(directory=CHART_DIR), name="charts")


@app.exception_handler(services.NotFoundError)
async def not_found_handler(_, exc: services.NotFoundError):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=404, content={"ok": False, "error": {"code": "not_found", "message": str(exc)}})


@app.exception_handler(ValueError)
async def value_error_handler(_, exc: ValueError):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=400, content={"ok": False, "error": {"code": "invalid_input", "message": str(exc)}})


def ok(data: Any, **meta: Any) -> dict[str, Any]:
    return {"ok": True, "data": data, **meta}


@app.get("/api/health")
def health():
    return ok({"status": "healthy", "llm_configured": llm_configured(), "orchestrator": "Nankai GeniOS Agent", "demo_mode": not llm_configured()})


@app.get("/api/projects")
def projects(lang: str = "en"):
    return ok(services.list_projects(lang))


@app.post("/api/projects")
def create_project(payload: dict[str, Any] = Body(...)):
    return ok(services.create_project(payload))


@app.get("/api/projects/{project_id}")
def get_project(project_id: int, lang: str = "en"):
    return ok(services.get_project(project_id, lang))


@app.patch("/api/projects/{project_id}")
def update_project(project_id: int, payload: dict[str, Any] = Body(...)):
    return ok(services.update_project(project_id, payload))


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int):
    services.delete_project(project_id)
    return ok({"deleted": project_id})


@app.post("/api/projects/{project_id}/plan")
def plan_project(project_id: int, payload: dict[str, Any] = Body(default={})):
    return ok(services.plan_research(project_id, payload.get("idea")))


@app.get("/api/projects/{project_id}/papers")
def papers(project_id: int):
    return ok(services.list_papers(project_id))


@app.post("/api/projects/{project_id}/papers")
def add_paper(project_id: int, payload: dict[str, Any] = Body(...)):
    return ok(services.add_paper(project_id, payload))


@app.get("/api/papers/{paper_id}")
def get_paper(paper_id: int):
    return ok(services.get_paper(paper_id))


@app.patch("/api/papers/{paper_id}")
def update_paper(paper_id: int, payload: dict[str, Any] = Body(...)):
    return ok(services.update_paper(paper_id, payload))


@app.delete("/api/papers/{paper_id}")
def delete_paper(paper_id: int):
    services.delete_paper(paper_id)
    return ok({"deleted": paper_id})


@app.get("/api/literature/search")
async def literature_search(q: str, year_from: int | None = None, year_to: int | None = None, limit: int = 12):
    return ok(await services.search_openalex(q, year_from, year_to, limit))


@app.post("/api/projects/{project_id}/papers/upload")
async def upload_pdf(project_id: int, file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 40 * 1024 * 1024:
        raise HTTPException(413, "PDF exceeds 40 MB limit")
    return ok(services.parse_pdf(project_id, file.filename or "paper.pdf", content))


@app.post("/api/papers/{paper_id}/ask")
def ask_paper(paper_id: int, payload: dict[str, Any] = Body(...)):
    return ok(services.ask_paper(paper_id, str(payload.get("question") or "总结论文的主要贡献")))


@app.get("/api/projects/{project_id}/evidence")
def evidence(project_id: int):
    return ok(services.list_evidence(project_id))


@app.patch("/api/evidence/{evidence_id}")
def update_evidence(evidence_id: int, payload: dict[str, Any] = Body(...)):
    return ok(services.update_evidence(evidence_id, payload))


@app.post("/api/projects/{project_id}/evidence/extract")
def extract_evidence(project_id: int, payload: dict[str, Any] = Body(...)):
    return ok(services.extract_evidence(project_id, int(payload["paper_id"])))


@app.get("/api/projects/{project_id}/evidence.csv", response_class=PlainTextResponse)
def export_evidence(project_id: int):
    return PlainTextResponse(services.export_evidence_csv(project_id), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=evidence-matrix.csv"})


@app.get("/api/projects/{project_id}/claims")
def claims(project_id: int):
    return ok(services.list_claims(project_id))


@app.post("/api/projects/{project_id}/claims")
def create_claim(project_id: int, payload: dict[str, Any] = Body(...)):
    return ok(services.create_claim(project_id, payload))


@app.post("/api/projects/{project_id}/gap")
def analyze_gap(project_id: int):
    return ok(services.analyze_gap(project_id))


@app.post("/api/projects/{project_id}/research-design")
def research_design(project_id: int):
    return ok(services.create_research_design(project_id))


@app.get("/api/projects/{project_id}/experiments")
def experiments(project_id: int):
    return ok(services.list_experiments(project_id))


@app.post("/api/projects/{project_id}/experiments")
def save_experiment(project_id: int, payload: dict[str, Any] = Body(...)):
    return ok(services.save_experiment(project_id, payload))


@app.post("/api/projects/{project_id}/analysis")
async def analyze_file(project_id: int, file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 30 * 1024 * 1024:
        raise HTTPException(413, "Data file exceeds 30 MB limit")
    return ok(services.analyze_dataframe(project_id, file.filename or "data.csv", content))


@app.get("/api/projects/{project_id}/analyses")
def analyses(project_id: int):
    return ok(services.list_analyses(project_id))


@app.get("/api/projects/{project_id}/manuscript")
def manuscript(project_id: int):
    return ok(services.list_manuscripts(project_id))


@app.put("/api/projects/{project_id}/manuscript/{section}")
def save_manuscript(project_id: int, section: str, payload: dict[str, Any] = Body(...)):
    return ok(services.save_manuscript(project_id, section, str(payload.get("content") or "")))


@app.post("/api/projects/{project_id}/writing/draft")
def draft_manuscript(project_id: int, payload: dict[str, Any] = Body(...)):
    return ok(services.draft_section(project_id, str(payload.get("section") or "Introduction")))


# GeniOS adapter endpoints: JSON-only tool contracts. These deliberately contain no
# orchestration loop; Nankai GeniOS remains the top-level Agent / Workflow runtime.
@app.post("/api/genios/project/create")
def genios_project_create(payload: dict[str, Any] = Body(...)):
    return ok(services.create_project(payload), tool="project_create")


@app.post("/api/genios/project/status")
def genios_project_status(payload: dict[str, Any] = Body(...)):
    return ok(services.get_project(int(payload["project_id"]), str(payload.get("lang") or "en")), tool="project_status")


@app.post("/api/genios/research/plan")
def genios_research_plan(payload: dict[str, Any] = Body(...)):
    return ok(services.plan_research(int(payload["project_id"]), payload.get("idea")), tool="research_plan")


@app.post("/api/genios/literature/search")
async def genios_literature_search(payload: dict[str, Any] = Body(...)):
    result = await services.search_openalex(str(payload["query"]), payload.get("year_from"), payload.get("year_to"), int(payload.get("limit", 12)))
    return ok(result, tool="literature_search")


@app.post("/api/genios/literature/add")
def genios_literature_add(payload: dict[str, Any] = Body(...)):
    return ok(services.add_paper(int(payload["project_id"]), payload["paper"]), tool="literature_add")


@app.post("/api/genios/paper/parse")
def genios_paper_parse(payload: dict[str, Any] = Body(...)):
    if not payload.get("pdf_base64"):
        raise ValueError("pdf_base64 is required for the JSON GeniOS parse tool")
    try:
        content = base64.b64decode(payload["pdf_base64"], validate=True)
    except Exception as exc:
        raise ValueError("pdf_base64 is not valid base64") from exc
    return ok(services.parse_pdf(int(payload["project_id"]), payload.get("filename") or "paper.pdf", content), tool="paper_parse")


@app.post("/api/genios/paper/ask")
def genios_paper_ask(payload: dict[str, Any] = Body(...)):
    return ok(services.ask_paper(int(payload["paper_id"]), str(payload["question"])), tool="paper_ask")


@app.post("/api/genios/evidence/extract")
def genios_evidence_extract(payload: dict[str, Any] = Body(...)):
    return ok(services.extract_evidence(int(payload["project_id"]), int(payload["paper_id"])), tool="evidence_extract")


@app.post("/api/genios/gap/analyze")
def genios_gap_analyze(payload: dict[str, Any] = Body(...)):
    return ok(services.analyze_gap(int(payload["project_id"])), tool="gap_analyze")


@app.post("/api/genios/research/design")
def genios_research_design(payload: dict[str, Any] = Body(...)):
    return ok(services.create_research_design(int(payload["project_id"])), tool="research_design")


@app.post("/api/genios/data/analyze")
def genios_data_analyze(payload: dict[str, Any] = Body(...)):
    if "rows" in payload:
        import json
        content = json.dumps(payload["rows"], ensure_ascii=False).encode("utf-8")
        filename = payload.get("filename") or "genios-data.json"
    elif payload.get("file_base64"):
        try: content = base64.b64decode(payload["file_base64"], validate=True)
        except Exception as exc: raise ValueError("file_base64 is not valid base64") from exc
        filename = payload.get("filename") or "genios-data.csv"
    else:
        raise ValueError("rows or file_base64 is required")
    return ok(services.analyze_dataframe(int(payload["project_id"]), filename, content), tool="data_analyze")


@app.post("/api/genios/writing/draft")
def genios_writing_draft(payload: dict[str, Any] = Body(...)):
    return ok(services.draft_section(int(payload["project_id"]), str(payload.get("section") or "Introduction")), tool="writing_draft")


@app.post("/api/genios/project/next-action")
def genios_next_action(payload: dict[str, Any] = Body(...)):
    project = services.get_project(int(payload["project_id"]), str(payload.get("lang") or "en"))
    return ok(project["next_action"], tool="project_next_action")
