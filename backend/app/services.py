from __future__ import annotations

import io
import json
import math
import re
import shutil
import uuid
from pathlib import Path
from typing import Any

import httpx
import matplotlib
import numpy as np
import pandas as pd
from pypdf import PdfReader
from scipy import stats

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from .config import CHART_DIR, OPENALEX_EMAIL, UPLOAD_DIR
from .database import connection, dumps, now, row_to_dict, rows_to_dicts
from .state_machine import determine_next_action


class NotFoundError(Exception):
    pass


def project_or_404(project_id: int) -> dict[str, Any]:
    with connection() as conn:
        project = row_to_dict(conn.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
    if not project:
        raise NotFoundError(f"Project {project_id} not found")
    return project


def create_project(data: dict[str, Any]) -> dict[str, Any]:
    timestamp = now()
    name = str(data.get("name") or "Untitled Research Project").strip()
    idea = str(data.get("idea") or "").strip()
    direction = str(data.get("direction") or "").strip()
    description = str(data.get("description") or "").strip()
    with connection() as conn:
        cursor = conn.execute(
            """INSERT INTO projects
            (name,idea,direction,description,research_questions,keywords,research_gap,gap_citations,hypotheses,stage,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (name, idea, direction, description, "[]", "[]", "", "[]", "[]", "idea", timestamp, timestamp),
        )
        project_id = cursor.lastrowid
        for section in ["Abstract","Introduction","Related Work","Method","Experiments","Results","Discussion","Conclusion"]:
            conn.execute("INSERT INTO manuscripts (project_id,section,content,updated_at) VALUES (?,?,?,?)", (project_id,section,"",timestamp))
    return get_project(project_id)


def list_projects(lang: str = "en") -> list[dict[str, Any]]:
    with connection() as conn:
        projects = rows_to_dicts(conn.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall())
    return [enrich_project(p, lang) for p in projects]


def get_project(project_id: int, lang: str = "en") -> dict[str, Any]:
    return enrich_project(project_or_404(project_id), lang)


def enrich_project(project: dict[str, Any], lang: str = "en") -> dict[str, Any]:
    pid = project["id"]
    with connection() as conn:
        counts = conn.execute(
            """SELECT
            (SELECT COUNT(*) FROM papers WHERE project_id=?) paper_count,
            (SELECT COUNT(*) FROM papers WHERE project_id=? AND is_core=1) core_paper_count,
            (SELECT COUNT(*) FROM papers WHERE project_id=? AND status='read') read_paper_count,
            (SELECT COUNT(*) FROM evidence WHERE project_id=?) evidence_count,
            (SELECT COUNT(*) FROM claims WHERE project_id=?) claim_count,
            (SELECT COUNT(*) FROM experiments WHERE project_id=?) experiment_count,
            (SELECT COUNT(*) FROM experiments WHERE project_id=? AND status='Completed') completed_experiment_count,
            (SELECT COUNT(*) FROM analyses WHERE project_id=?) analysis_count,
            (SELECT COUNT(*) FROM manuscripts WHERE project_id=? AND length(trim(content))>80) manuscript_filled
            """, (pid, pid, pid, pid, pid, pid, pid, pid, pid)).fetchone()
        tasks = rows_to_dicts(conn.execute("SELECT * FROM tasks WHERE project_id=? ORDER BY id", (pid,)).fetchall())
    project.update(dict(counts))
    project["next_action"] = determine_next_action(project, lang)
    project["progress"] = project["next_action"]["progress"]
    project["tasks"] = tasks
    return project


def update_project(project_id: int, data: dict[str, Any]) -> dict[str, Any]:
    project_or_404(project_id)
    allowed = {"name", "idea", "direction", "description", "research_questions", "keywords", "research_gap", "gap_citations", "hypotheses", "stage"}
    fields: list[str] = []
    values: list[Any] = []
    for key, value in data.items():
        if key in allowed:
            fields.append(f"{key}=?")
            values.append(dumps(value) if key in {"research_questions","keywords","gap_citations","hypotheses"} else value)
    if fields:
        fields.append("updated_at=?")
        values.extend([now(), project_id])
        with connection() as conn:
            conn.execute(f"UPDATE projects SET {', '.join(fields)} WHERE id=?", values)
    return get_project(project_id)


def delete_project(project_id: int) -> None:
    project_or_404(project_id)
    with connection() as conn:
        conn.execute("DELETE FROM projects WHERE id=?", (project_id,))


def plan_research(project_id: int, idea: str | None = None) -> dict[str, Any]:
    project = project_or_404(project_id)
    topic = (idea or project["idea"] or project["name"]).strip()
    cleaned = re.sub(r"[。.!?？]+$", "", topic)
    keywords = extract_keywords(cleaned)
    questions = [
        f"RQ1: {cleaned}在目标任务上的效果相较基线如何？",
        "RQ2: 该方法在不同数据子集或场景中的效果是否一致？",
        "RQ3: 哪些关键因素影响效果、成本与可靠性之间的权衡？",
    ]
    hypotheses = [
        "H1: 所研究方法相较基线在主要评价指标上有显著改进。",
        "H2: 方法收益会随数据特征或任务类别而变化。",
    ]
    tasks = [
        "明确研究对象、对照组和主要评价指标",
        "检索并筛选核心文献",
        "建立证据矩阵并识别矛盾结论",
        "设计可复现的对照实验",
        "执行统计分析并回链研究问题",
    ]
    with connection() as conn:
        conn.execute("UPDATE projects SET research_questions=?,keywords=?,hypotheses=?,stage='literature',updated_at=? WHERE id=?", (dumps(questions),dumps(keywords),dumps(hypotheses),now(),project_id))
        conn.execute("DELETE FROM tasks WHERE project_id=?", (project_id,))
        for title in tasks:
            conn.execute("INSERT INTO tasks (project_id,title,phase,done) VALUES (?,?,?,0)", (project_id,title,"Planner"))
    return {"objective": f"围绕“{cleaned}”形成可验证、可追溯的研究结论。", "research_questions": questions, "keywords": keywords, "scope": "以可获得的同行评议文献、可复现实验数据和项目证据为边界。", "hypotheses": hypotheses, "tasks": tasks, "mode": "deterministic-fallback"}


def extract_keywords(text: str) -> list[str]:
    latin = re.findall(r"[A-Za-z][A-Za-z0-9+-]{2,}", text)
    chinese = re.findall(r"[\u4e00-\u9fff]{2,8}", text)
    stop = {"是否", "能够", "研究", "提升", "影响", "能力", "一个", "以及", "进行"}
    values: list[str] = []
    for word in latin + chinese:
        normalized = word.lower() if word.isascii() else word
        if normalized not in stop and normalized not in values:
            values.append(normalized)
    return values[:8] or ["research", "evidence"]


def _reconstruct_abstract(inverted: dict[str, list[int]] | None) -> str:
    if not inverted:
        return ""
    pairs = [(position, word) for word, positions in inverted.items() for position in positions]
    return " ".join(word for _, word in sorted(pairs))


async def search_openalex(query: str, year_from: int | None = None, year_to: int | None = None, limit: int = 12) -> dict[str, Any]:
    params: dict[str, Any] = {"search": query, "per-page": min(max(limit, 1), 25)}
    filters: list[str] = []
    if year_from:
        filters.append(f"from_publication_date:{year_from}-01-01")
    if year_to:
        filters.append(f"to_publication_date:{year_to}-12-31")
    if filters:
        params["filter"] = ",".join(filters)
    if OPENALEX_EMAIL:
        params["mailto"] = OPENALEX_EMAIL
    try:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "ScholarFlow/1.0"}) as client:
            response = await client.get("https://api.openalex.org/works", params=params)
            response.raise_for_status()
            works = response.json().get("results", [])
    except (httpx.HTTPError, ValueError) as exc:
        return {"items": [], "source": "openalex", "error": f"OpenAlex request failed: {exc}", "query": query}
    items = []
    for index, work in enumerate(works):
        authors = [a.get("author", {}).get("display_name", "") for a in work.get("authorships", [])[:8]]
        primary = work.get("primary_location") or {}
        source = primary.get("source") or {}
        doi = work.get("doi")
        items.append({
            "source_id": work.get("id"), "title": work.get("title") or "Untitled",
            "authors": [a for a in authors if a], "year": work.get("publication_year"),
            "venue": source.get("display_name") or "", "doi": doi.removeprefix("https://doi.org/") if doi else None,
            "cited_by_count": work.get("cited_by_count", 0), "abstract": _reconstruct_abstract(work.get("abstract_inverted_index")),
            "relevance": round(max(0.5, 0.98 - index * 0.035), 2), "source": "openalex",
        })
    return {"items": items, "source": "openalex", "query": query, "count": len(items)}


def list_papers(project_id: int) -> list[dict[str, Any]]:
    project_or_404(project_id)
    with connection() as conn:
        return rows_to_dicts(conn.execute("SELECT * FROM papers WHERE project_id=? ORDER BY is_core DESC, relevance DESC, id DESC", (project_id,)).fetchall())


def add_paper(project_id: int, data: dict[str, Any]) -> dict[str, Any]:
    project_or_404(project_id)
    timestamp = now()
    doi = data.get("doi") or None
    source_id = data.get("source_id") or None
    with connection() as conn:
        duplicate = None
        if doi:
            duplicate = conn.execute("SELECT * FROM papers WHERE project_id=? AND doi=?", (project_id,doi)).fetchone()
        elif source_id:
            duplicate = conn.execute("SELECT * FROM papers WHERE project_id=? AND source_id=?", (project_id,source_id)).fetchone()
        if duplicate:
            return row_to_dict(duplicate) or {}
        cursor = conn.execute(
            """INSERT INTO papers
            (project_id,title,authors,year,venue,doi,cited_by_count,abstract,source,source_id,relevance,status,is_core,tags,notes,full_text,sections,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (project_id,data.get("title") or "Untitled",dumps(data.get("authors") or []),data.get("year"),data.get("venue") or "",doi,int(data.get("cited_by_count") or 0),data.get("abstract") or "",data.get("source") or "manual",source_id,float(data.get("relevance") or 0),data.get("status") or "unread",int(bool(data.get("is_core"))),dumps(data.get("tags") or []),data.get("notes") or "",data.get("full_text") or "",dumps(data.get("sections") or []),timestamp),
        )
        row = conn.execute("SELECT * FROM papers WHERE id=?", (cursor.lastrowid,)).fetchone()
    return row_to_dict(row) or {}


def update_paper(paper_id: int, data: dict[str, Any]) -> dict[str, Any]:
    allowed = {"title","authors","year","venue","doi","abstract","status","is_core","tags","notes","full_text","sections"}
    fields: list[str] = []
    values: list[Any] = []
    for key, value in data.items():
        if key in allowed:
            fields.append(f"{key}=?")
            if key in {"authors","tags","sections"}:
                value = dumps(value)
            elif key == "is_core":
                value = int(bool(value))
            values.append(value)
    with connection() as conn:
        existing = conn.execute("SELECT * FROM papers WHERE id=?", (paper_id,)).fetchone()
        if not existing:
            raise NotFoundError(f"Paper {paper_id} not found")
        if fields:
            conn.execute(f"UPDATE papers SET {', '.join(fields)} WHERE id=?", (*values,paper_id))
        row = conn.execute("SELECT * FROM papers WHERE id=?", (paper_id,)).fetchone()
    return row_to_dict(row) or {}


def delete_paper(paper_id: int) -> None:
    with connection() as conn:
        result = conn.execute("DELETE FROM papers WHERE id=?", (paper_id,))
        if result.rowcount == 0:
            raise NotFoundError(f"Paper {paper_id} not found")


def get_paper(paper_id: int) -> dict[str, Any]:
    with connection() as conn:
        row = conn.execute("SELECT * FROM papers WHERE id=?", (paper_id,)).fetchone()
        if not row:
            raise NotFoundError(f"Paper {paper_id} not found")
        paper = row_to_dict(row) or {}
        paper["evidence"] = rows_to_dicts(conn.execute("SELECT * FROM evidence WHERE paper_id=?", (paper_id,)).fetchall())
    return paper


def parse_pdf(project_id: int, filename: str, content: bytes) -> dict[str, Any]:
    project_or_404(project_id)
    if not filename.lower().endswith(".pdf"):
        raise ValueError("Only PDF files are supported by this endpoint")
    safe_name = f"{uuid.uuid4().hex}_{Path(filename).name}"
    file_path = UPLOAD_DIR / safe_name
    file_path.write_bytes(content)
    try:
        reader = PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        full_text = "\n\n".join(pages).strip()
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise ValueError(f"PDF parsing failed: {exc}") from exc
    if not full_text:
        raise ValueError("No extractable text found. The PDF may require OCR/Docling configuration.")
    title = (reader.metadata.title if reader.metadata else None) or Path(filename).stem
    sections = split_sections(full_text)
    paper = add_paper(project_id, {"title": title, "authors": [], "source": "uploaded-pdf", "abstract": sections[0]["content"][:1200] if sections else full_text[:1200], "full_text": full_text, "sections": sections, "status": "to_read"})
    with connection() as conn:
        conn.execute("UPDATE papers SET file_path=? WHERE id=?", (str(file_path),paper["id"]))
    result = get_paper(paper["id"])
    result["parser"] = "pypdf-compatible adapter"
    result["docling_status"] = "Use SCHOLARFLOW_DOCLING=1 in an extended environment for layout-aware parsing."
    return result


def split_sections(text: str) -> list[dict[str, str]]:
    heading_pattern = re.compile(r"(?im)^(abstract|introduction|related work|background|method(?:ology)?|experiments?|results?|discussion|limitations?|conclusion|references)\s*$")
    matches = list(heading_pattern.finditer(text))
    if not matches:
        return [{"title": "Full Text", "content": text}]
    sections: list[dict[str, str]] = []
    if matches[0].start() > 0:
        sections.append({"title": "Document", "content": text[:matches[0].start()].strip()})
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections.append({"title": match.group(1).title(), "content": text[match.end():end].strip()})
    return [s for s in sections if s["content"]]


def ask_paper(paper_id: int, question: str) -> dict[str, Any]:
    paper = get_paper(paper_id)
    text = paper.get("full_text") or paper.get("abstract") or ""
    if not text:
        return {"answer": "该论文暂无可检索全文。请先上传 PDF。", "citations": [], "mode": "local-retrieval"}
    chunks = [text[i:i+1000] for i in range(0, len(text), 800)]
    query_terms = set(re.findall(r"\w+", question.lower()))
    scored = sorted(((sum(term in chunk.lower() for term in query_terms), index, chunk) for index,chunk in enumerate(chunks)), reverse=True)
    best = [item for item in scored if item[0] > 0][:3] or scored[:1]
    citations = [{"paper_id": paper_id, "title": paper["title"], "chunk": index + 1, "snippet": chunk[:420]} for _,index,chunk in best]
    answer = "基于论文中最相关的片段，建议重点核对以下证据：" + " ".join(c["snippet"][:180] for c in citations)
    return {"answer": answer, "citations": citations, "mode": "local-retrieval", "warning": "未配置 LLM 时仅返回检索式答案，不扩写未经证实的结论。"}


def list_evidence(project_id: int) -> list[dict[str, Any]]:
    project_or_404(project_id)
    with connection() as conn:
        rows = conn.execute("""SELECT evidence.*, papers.title paper_title FROM evidence JOIN papers ON papers.id=evidence.paper_id WHERE evidence.project_id=? ORDER BY evidence.id DESC""", (project_id,)).fetchall()
        return rows_to_dicts(rows)


def extract_evidence(project_id: int, paper_id: int) -> dict[str, Any]:
    paper = get_paper(paper_id)
    if paper["project_id"] != project_id:
        raise ValueError("Paper does not belong to this project")
    text = paper.get("full_text") or paper.get("abstract") or ""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?。！？])\s+", text) if len(s.strip()) > 25]
    def find(words: list[str]) -> str:
        return next((s for s in sentences if any(w in s.lower() for w in words)), "")
    values = {
        "problem": find(["problem","challenge","aim","objective","问题","目标"]),
        "method": find(["method","approach","model","方法","模型"]),
        "dataset": find(["dataset","benchmark","corpus","数据集"]),
        "baseline": find(["baseline","compare","comparison","基线","对比"]),
        "metric": find(["accuracy","precision","recall","f1","metric","指标"]),
        "result": find(["result","improve","outperform","结果","提升"]),
        "limitation": find(["limitation","however","future","局限","不足"]),
    }
    snippet = values["result"] or values["method"] or (sentences[0] if sentences else text[:500])
    with connection() as conn:
        cursor = conn.execute("""INSERT INTO evidence
        (project_id,paper_id,problem,method,dataset,baseline,metric,result,limitation,source_section,source_snippet,confidence,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""", (project_id,paper_id,values["problem"],values["method"],values["dataset"],values["baseline"],values["metric"],values["result"],values["limitation"],"Auto-extracted",snippet,.55 if snippet else .2,now()))
        row = conn.execute("SELECT * FROM evidence WHERE id=?", (cursor.lastrowid,)).fetchone()
    return row_to_dict(row) or {}


def update_evidence(evidence_id: int, data: dict[str, Any]) -> dict[str, Any]:
    allowed = {"problem","method","dataset","baseline","metric","result","limitation","source_section","source_snippet","confidence"}
    fields = [f"{key}=?" for key in data if key in allowed]
    values = [data[key] for key in data if key in allowed]
    with connection() as conn:
        if fields:
            conn.execute(f"UPDATE evidence SET {', '.join(fields)} WHERE id=?", (*values,evidence_id))
        row = conn.execute("SELECT * FROM evidence WHERE id=?", (evidence_id,)).fetchone()
    if not row:
        raise NotFoundError(f"Evidence {evidence_id} not found")
    return row_to_dict(row) or {}


def list_claims(project_id: int) -> list[dict[str, Any]]:
    project_or_404(project_id)
    with connection() as conn:
        claims = rows_to_dicts(conn.execute("SELECT * FROM claims WHERE project_id=? ORDER BY id", (project_id,)).fetchall())
        for claim in claims:
            claim["links"] = rows_to_dicts(conn.execute("""SELECT claim_links.*,papers.title paper_title FROM claim_links JOIN papers ON papers.id=claim_links.paper_id WHERE claim_id=?""", (claim["id"],)).fetchall())
    return claims


def create_claim(project_id: int, data: dict[str, Any]) -> dict[str, Any]:
    project_or_404(project_id)
    text = str(data.get("text") or "").strip()
    if not text:
        raise ValueError("Claim text is required")
    confidence = min(1.0, max(0.0, float(data.get("confidence", 0.5))))
    evidence_id = data.get("evidence_id")
    paper_id = data.get("paper_id")
    if evidence_id:
        with connection() as conn:
            evidence = conn.execute("SELECT * FROM evidence WHERE id=? AND project_id=?", (int(evidence_id), project_id)).fetchone()
            if not evidence:
                raise ValueError("Selected evidence does not belong to this project")
            paper_id = evidence["paper_id"]
    with connection() as conn:
        claim_id = conn.execute(
            "INSERT INTO claims (project_id,text,confidence,notes,created_at) VALUES (?,?,?,?,?)",
            (project_id, text, confidence, str(data.get("notes") or ""), now()),
        ).lastrowid
        if paper_id:
            paper = conn.execute("SELECT id FROM papers WHERE id=? AND project_id=?", (int(paper_id), project_id)).fetchone()
            if not paper:
                raise ValueError("Selected paper does not belong to this project")
            conn.execute(
                "INSERT INTO claim_links (claim_id,paper_id,evidence_id,stance,snippet) VALUES (?,?,?,?,?)",
                (claim_id, int(paper_id), int(evidence_id) if evidence_id else None, str(data.get("stance") or "supporting"), str(data.get("snippet") or "")),
            )
    return next(claim for claim in list_claims(project_id) if claim["id"] == claim_id)


def analyze_gap(project_id: int) -> dict[str, Any]:
    project = get_project(project_id)
    evidence = list_evidence(project_id)
    claims = list_claims(project_id)
    if not evidence:
        return {"gap": "当前没有结构化证据，无法生成可追溯 Research Gap。", "citations": [], "coverage": []}
    weak = [item for item in evidence if float(item.get("confidence") or 0) < .6]
    citations = [item["paper_id"] for item in evidence[:5]]
    gap = f"项目已有 {len(evidence)} 条证据与 {len(claims)} 个 Claim，但低置信证据占 {len(weak)} 条。不同数据子集上的稳定性、负面结果与方法成本尚未形成充分交叉验证。建议优先设计分组对照实验，并用真实导入文献替换 demo/sample 证据。"
    contradictions: list[str] = []
    if weak:
        contradictions.append(f"有 {len(weak)} 条低置信证据需要复核后确认结论方向。")
    if len(claims) < len(evidence):
        contradictions.append("部分证据尚未转化为可追溯的 Claim，结论覆盖面可能不完整。")
    if not contradictions:
        contradictions.append("当前证据之间尚未发现明显矛盾，仍需扩大来源范围以验证结论稳定性。")
    update_project(project_id, {"research_gap": gap, "gap_citations": citations, "stage": "design"})
    return {"gap": gap, "citations": citations, "coverage": [{"question": rq, "evidence_count": max(0, len(evidence)//max(1,len(project["research_questions"]))) } for rq in project["research_questions"]], "contradictions": contradictions}


def create_research_design(project_id: int) -> dict[str, Any]:
    project = get_project(project_id)
    topic = (project["idea"] or project["name"]).strip().rstrip("。.!?！？")
    rq = project["research_questions"] or [f"How does {topic} compare with the baseline on the target task?"]
    hypothesis = (project["hypotheses"] or ["The proposed method improves the primary metric over the baseline."])[0]
    metrics = ["Primary effect metric", "Runtime cost / latency"]
    controls = ["Dataset and split", "Parameters", "Random seed"]
    risks = ["Data leakage", "Metric selection bias", "Insufficient sample size", "Unverified evidence"]
    designs = [
        {"name":f"Baseline Control: {topic}","research_question":rq[0],"hypothesis":"Establish a reproducible baseline.","description":"Fix the dataset and parameters, then record the baseline on the primary metric.","status":"Ready","input":"Baseline configuration","dataset":"Project dataset","metrics":metrics},
        {"name":f"Proposed Method: {topic}","research_question":rq[0],"hypothesis":hypothesis,"description":"Change only the core independent variable and compare against the baseline in pairs.","status":"Planned","input":"Proposed configuration","dataset":"Same project dataset","metrics":metrics},
    ]
    created = []
    with connection() as conn:
        existing = conn.execute("SELECT COUNT(*) FROM experiments WHERE project_id=?", (project_id,)).fetchone()[0]
        if existing == 0:
            for item in designs:
                cursor = conn.execute("""INSERT INTO experiments (project_id,name,research_question,hypothesis,description,status,input,dataset,metrics,result,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""", (project_id,item["name"],item["research_question"],item["hypothesis"],item["description"],item["status"],item["input"],item["dataset"],dumps(item["metrics"]),"","",now()))
                created.append(cursor.lastrowid)
    return {
        "topic": topic,
        "hypothesis": hypothesis,
        "variables": {"independent": "Method / treatment configuration", "dependent": metrics, "controls": controls},
        "dataset": "Compare all conditions on the same dataset and split.",
        "baselines": [designs[0]["name"]],
        "metrics": metrics,
        "risks": risks,
        "expected_output": "Paired results with confidence intervals and subgroup analysis.",
        "design_flow": {"control": designs[0]["name"], "treatment": designs[1]["name"], "evaluation": "Paired comparison + subgroup analysis"},
        "created_experiment_ids": created,
    }


def list_experiments(project_id: int) -> list[dict[str, Any]]:
    project_or_404(project_id)
    with connection() as conn:
        return rows_to_dicts(conn.execute("SELECT * FROM experiments WHERE project_id=? ORDER BY id", (project_id,)).fetchall())


def save_experiment(project_id: int, data: dict[str, Any]) -> dict[str, Any]:
    project_or_404(project_id)
    with connection() as conn:
        if data.get("id"):
            experiment_id = int(data["id"])
            allowed = ["name","research_question","hypothesis","description","status","input","dataset","metrics","result","notes"]
            fields = []
            values = []
            for key in allowed:
                if key in data:
                    fields.append(f"{key}=?")
                    values.append(dumps(data[key]) if key == "metrics" else data[key])
            if fields:
                conn.execute(f"UPDATE experiments SET {', '.join(fields)} WHERE id=? AND project_id=?", (*values,experiment_id,project_id))
        else:
            experiment_id = conn.execute("""INSERT INTO experiments (project_id,name,research_question,hypothesis,description,status,input,dataset,metrics,result,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""", (project_id,data.get("name") or "New Experiment",data.get("research_question") or "",data.get("hypothesis") or "",data.get("description") or "",data.get("status") or "Planned",data.get("input") or "",data.get("dataset") or "",dumps(data.get("metrics") or []),data.get("result") or "",data.get("notes") or "",now())).lastrowid
        row = conn.execute("SELECT * FROM experiments WHERE id=?", (experiment_id,)).fetchone()
    return row_to_dict(row) or {}


def _json_safe(value: Any) -> Any:
    if isinstance(value, (np.integer,)): return int(value)
    if isinstance(value, (np.floating,)): return None if math.isnan(float(value)) else float(value)
    if isinstance(value, (np.ndarray,)): return value.tolist()
    return value


def analyze_dataframe(project_id: int, filename: str, content: bytes) -> dict[str, Any]:
    project_or_404(project_id)
    suffix = Path(filename).suffix.lower()
    try:
        if suffix == ".csv": df = pd.read_csv(io.BytesIO(content))
        elif suffix in {".xlsx", ".xls"}: df = pd.read_excel(io.BytesIO(content))
        elif suffix == ".json": df = pd.read_json(io.BytesIO(content))
        else: raise ValueError("Unsupported file. Use CSV, XLSX, XLS, or JSON.")
    except Exception as exc:
        raise ValueError(f"Could not read data file: {exc}") from exc
    if df.empty:
        raise ValueError("The uploaded dataset is empty")
    numeric = df.select_dtypes(include="number")
    overview = {"rows":int(df.shape[0]),"columns":int(df.shape[1]),"column_names":list(map(str,df.columns)),"numeric_columns":list(map(str,numeric.columns)),"missing_values":{str(k):int(v) for k,v in df.isna().sum().items()}}
    describe = json.loads(df.describe(include="all").replace({np.nan:None}).to_json())
    tests: list[dict[str, Any]] = []
    if len(numeric.columns) >= 2:
        a,b = numeric.columns[:2]
        clean = df[[a,b]].dropna()
        if len(clean) >= 3:
            correlation,p_value = stats.pearsonr(clean[a],clean[b])
            tests.append({"test":"Pearson correlation","variables":[str(a),str(b)],"statistic":_json_safe(correlation),"p_value":_json_safe(p_value),"interpretation":"显著相关" if p_value < .05 else "未发现显著线性相关"})
    charts: list[str] = []
    if len(numeric.columns):
        chart_name = f"{project_id}_{uuid.uuid4().hex}.png"
        chart_path = CHART_DIR / chart_name
        columns = list(numeric.columns[:4])
        numeric[columns].hist(figsize=(10,6), color="#4f6ef7", alpha=.82, bins=16)
        plt.suptitle("Numeric distributions")
        plt.tight_layout()
        plt.savefig(chart_path, dpi=140, bbox_inches="tight")
        plt.close("all")
        charts.append(f"/api/charts/{chart_name}")
    result = {"filename":filename,"overview":overview,"descriptive_statistics":describe,"tests":tests,"charts":charts,"recommendations":["检查高缺失率字段后再进行推断统计。","对主要指标报告效应量与置信区间。","按实验组或数据子集进行分组对比。"]}
    with connection() as conn:
        cursor = conn.execute("INSERT INTO analyses (project_id,filename,summary,charts,created_at) VALUES (?,?,?,?,?)", (project_id,filename,dumps(result),dumps(charts),now()))
        result["id"] = cursor.lastrowid
    return result


def list_analyses(project_id: int) -> list[dict[str, Any]]:
    project_or_404(project_id)
    with connection() as conn:
        rows = rows_to_dicts(conn.execute("SELECT * FROM analyses WHERE project_id=? ORDER BY id DESC", (project_id,)).fetchall())
    for row in rows:
        try: row["summary"] = json.loads(row["summary"])
        except (json.JSONDecodeError, TypeError): pass
    return rows


def list_manuscripts(project_id: int) -> list[dict[str, Any]]:
    project_or_404(project_id)
    with connection() as conn:
        return rows_to_dicts(conn.execute("SELECT * FROM manuscripts WHERE project_id=? ORDER BY id", (project_id,)).fetchall())


def save_manuscript(project_id: int, section: str, content: str) -> dict[str, Any]:
    project_or_404(project_id)
    with connection() as conn:
        conn.execute("""INSERT INTO manuscripts (project_id,section,content,updated_at) VALUES (?,?,?,?) ON CONFLICT(project_id,section) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at""", (project_id,section,content,now()))
        row = conn.execute("SELECT * FROM manuscripts WHERE project_id=? AND section=?", (project_id,section)).fetchone()
    return row_to_dict(row) or {}


def draft_section(project_id: int, section: str) -> dict[str, Any]:
    project = get_project(project_id)
    evidence = list_evidence(project_id)
    cited = [item for item in evidence if item.get("result") or item.get("method")]
    if not cited:
        content = f"{section} 草稿：该陈述当前缺少项目文献证据。请先在 Evidence Matrix 中提取并核验证据。"
        citations: list[dict[str, Any]] = []
    else:
        snippets = []
        citations = []
        for item in cited[:3]:
            statement = item.get("result") or item.get("method")
            snippets.append(f"{statement} [Paper {item['paper_id']}; Evidence {item['id']}]")
            citations.append({"paper_id":item["paper_id"],"evidence_id":item["id"],"title":item.get("paper_title"),"snippet":item.get("source_snippet")})
        content = f"{section} 证据辅助草稿：" + " ".join(snippets) + " 未被项目证据支持的推论需在提交前删除或补充来源。"
    saved = save_manuscript(project_id, section, content)
    return {"section":saved,"citations":citations,"project":project["name"],"mode":"citation-aware deterministic draft"}


def export_evidence_csv(project_id: int) -> str:
    evidence = list_evidence(project_id)
    columns = ["paper_title","problem","method","dataset","baseline","metric","result","limitation","source_section","source_snippet","confidence"]
    return pd.DataFrame([{key:item.get(key,"") for key in columns} for item in evidence]).to_csv(index=False)
