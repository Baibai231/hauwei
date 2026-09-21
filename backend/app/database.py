from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any, Iterator

from .config import DB_PATH


def now() -> str:
    return datetime.now(UTC).isoformat()


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  idea TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  research_questions TEXT NOT NULL DEFAULT '[]',
  keywords TEXT NOT NULL DEFAULT '[]',
  research_gap TEXT NOT NULL DEFAULT '',
  gap_citations TEXT NOT NULL DEFAULT '[]',
  hypotheses TEXT NOT NULL DEFAULT '[]',
  stage TEXT NOT NULL DEFAULT 'idea',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors TEXT NOT NULL DEFAULT '[]',
  year INTEGER,
  venue TEXT NOT NULL DEFAULT '',
  doi TEXT,
  cited_by_count INTEGER NOT NULL DEFAULT 0,
  abstract TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  relevance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unread',
  is_core INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  file_path TEXT,
  full_text TEXT NOT NULL DEFAULT '',
  sections TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  problem TEXT NOT NULL DEFAULT '', method TEXT NOT NULL DEFAULT '',
  dataset TEXT NOT NULL DEFAULT '', baseline TEXT NOT NULL DEFAULT '',
  metric TEXT NOT NULL DEFAULT '', result TEXT NOT NULL DEFAULT '',
  limitation TEXT NOT NULL DEFAULT '', source_section TEXT NOT NULL DEFAULT '',
  source_snippet TEXT NOT NULL DEFAULT '', confidence REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0.5,
  notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS claim_links (
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  evidence_id INTEGER REFERENCES evidence(id) ON DELETE SET NULL,
  stance TEXT NOT NULL DEFAULT 'supporting', snippet TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (claim_id, paper_id)
);
CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, research_question TEXT NOT NULL DEFAULT '',
  hypothesis TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Planned', input TEXT NOT NULL DEFAULT '',
  dataset TEXT NOT NULL DEFAULT '', metrics TEXT NOT NULL DEFAULT '[]',
  result TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL, phase TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS manuscripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL,
  UNIQUE(project_id, section)
);
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL, summary TEXT NOT NULL, charts TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
"""


JSON_FIELDS = {
    "research_questions", "keywords", "gap_citations", "hypotheses", "authors",
    "tags", "sections", "metrics", "charts",
}


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    result = dict(row)
    for key in JSON_FIELDS & result.keys():
        try:
            result[key] = json.loads(result[key] or "[]")
        except json.JSONDecodeError:
            result[key] = []
    for key in ("is_core", "done"):
        if key in result:
            result[key] = bool(result[key])
    return result


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [row_to_dict(row) or {} for row in rows]


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def init_db() -> None:
    with connection() as conn:
        conn.executescript(SCHEMA)
        count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        if count == 0:
            seed_demo(conn)


def seed_demo(conn: sqlite3.Connection) -> None:
    timestamp = now()
    cursor = conn.execute(
        """INSERT INTO projects
        (name, idea, direction, description, research_questions, keywords, research_gap,
         gap_citations, hypotheses, stage, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            "RAG for LLM Vulnerability Detection",
            "研究检索增强生成是否能提升大语言模型的代码漏洞检测能力。",
            "AI Security",
            "比较纯 LLM 与检索增强方法在不同漏洞类型上的检测效果。演示数据均标记为 sample，不冒充真实论文。",
            dumps([
                "RQ1: RAG 是否提升代码漏洞检测的 Recall？",
                "RQ2: 不同 CWE 漏洞类型的增益是否一致？",
                "RQ3: 知识库规模与检索质量如何影响检测性能？",
            ]),
            dumps(["retrieval-augmented generation", "vulnerability detection", "large language models", "CWE"]),
            "现有项目证据显示 RAG 可能提高总体召回率，但不同 CWE 类别的增益、知识库规模效应以及错误检索造成的误报仍缺少统一对照实验。",
            dumps([1, 2, 3]),
            dumps([
                "H1: 领域知识检索会显著提高漏洞检测 Recall。",
                "H2: RAG 对训练样本较少的 CWE 类型提升更明显。",
            ]),
            "design", timestamp, timestamp,
        ),
    )
    project_id = cursor.lastrowid
    papers = [
        ("Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", ["Patrick Lewis", "Ethan Perez", "Aleksandra Piktus"], 2020, "NeurIPS", "10.48550/arXiv.2005.11401", 7200, "RAG combines parametric generation with non-parametric dense retrieval. This sample record summarizes a known foundational work; verify metadata through OpenAlex before formal citation.", 0.96, 1, "read"),
        ("A Systematic Study of LLMs for Software Vulnerability Detection", ["Sample Research Team"], 2024, "Demo venue", None, 0, "Sample-only record used to demonstrate evidence workflows. It is not a bibliographic citation and has no DOI.", 0.91, 1, "read"),
        ("Knowledge-Grounded Code Analysis with Retrieval", ["ScholarFlow Demo Authors"], 2025, "Sample dataset", None, 0, "Synthetic demo paper record: retrieval context improved recall in selected vulnerability categories but increased false positives.", 0.87, 1, "read"),
        ("Evaluating Context Quality in Secure Code Review", ["ScholarFlow Demo Authors"], 2025, "Sample dataset", None, 0, "Synthetic demo record exploring retrieval noise and context quality in secure code review.", 0.79, 0, "to_read"),
        ("Large Language Models for Automated Code Review", ["Sample Research Team"], 2024, "Sample venue", None, 0, "Sample-only record for the offline competition demonstration.", 0.75, 0, "unread"),
    ]
    paper_ids: list[int] = []
    for title, authors, year, venue, doi, citations, abstract, relevance, core, status in papers:
        cur = conn.execute(
            """INSERT INTO papers
            (project_id,title,authors,year,venue,doi,cited_by_count,abstract,source,source_id,relevance,status,is_core,tags,notes,full_text,sections,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (project_id,title,dumps(authors),year,venue,doi,citations,abstract,"demo/sample",None,relevance,status,core,dumps(["demo/sample"]),"",abstract,dumps([{"title":"Abstract","content":abstract}]),timestamp),
        )
        paper_ids.append(cur.lastrowid)
    evidence_rows = [
        (paper_ids[0], "Knowledge-intensive generation", "Dense retrieval + seq2seq generation", "Wikipedia passages", "Parametric seq2seq", "Factuality / QA metrics", "Retrieval supplies external evidence to generation.", "Not designed for source-code security.", "Abstract", papers[0][6], .90),
        (paper_ids[1], "Detect software vulnerabilities with LLMs", "Prompted code classification", "Sample CWE benchmark", "Static prompting", "Precision, Recall, F1", "Recall varies substantially across CWE types.", "Sample evidence; replace with imported paper evidence.", "Results", "Sample result: performance is heterogeneous across vulnerability classes.", .55),
        (paper_ids[2], "Ground vulnerability decisions in external knowledge", "RAG over CWE descriptions", "Sample balanced code set", "LLM without retrieval", "Recall, F1", "Sample result: RAG improves recall while slightly reducing precision.", "Retrieval noise can increase false positives.", "Results", "Synthetic demonstration snippet; not a citable external result.", .45),
    ]
    evidence_ids = []
    for values in evidence_rows:
        cur = conn.execute(
            """INSERT INTO evidence
            (project_id,paper_id,problem,method,dataset,baseline,metric,result,limitation,source_section,source_snippet,confidence,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""", (project_id, *values, timestamp))
        evidence_ids.append(cur.lastrowid)
    claims = [
        ("检索增强可以为模型输出提供外部知识依据。", .88, [(paper_ids[0], evidence_ids[0], "supporting")]),
        ("RAG 对漏洞检测召回率的提升可能伴随误报增加。", .48, [(paper_ids[2], evidence_ids[2], "supporting")]),
        ("不同 CWE 类别从 RAG 中获得的收益并不一致。", .52, [(paper_ids[1], evidence_ids[1], "supporting"), (paper_ids[2], evidence_ids[2], "supporting")]),
    ]
    for text, confidence, links in claims:
        claim_id = conn.execute("INSERT INTO claims (project_id,text,confidence,notes,created_at) VALUES (?,?,?,?,?)", (project_id,text,confidence,"Demo claim: confidence reflects current project evidence.",timestamp)).lastrowid
        for paper_id, evidence_id, stance in links:
            conn.execute("INSERT INTO claim_links (claim_id,paper_id,evidence_id,stance,snippet) VALUES (?,?,?,?,?)", (claim_id,paper_id,evidence_id,stance,"Linked from the project evidence matrix."))
    experiments = [
        ("Experiment 1 · Baseline LLM", "RQ1", "建立无检索基线", "在固定测试集上评估基础模型。", "Completed", "Prompt + source code", "Sample CWE benchmark", ["Precision","Recall","F1"], "Sample: Recall 0.61, F1 0.66"),
        ("Experiment 2 · LLM + RAG", "RQ1 / RQ2", "RAG 提高 Recall", "检索 CWE 与安全模式后进行同集评估。", "Ready", "Top-k retrieved evidence + source code", "Sample CWE benchmark", ["Precision","Recall","F1"], ""),
        ("Experiment 3 · Retrieval Scale", "RQ3", "知识库规模存在收益饱和点", "比较小、中、大三种知识库。", "Planned", "Three index sizes", "Sample CWE benchmark", ["Recall","Latency"], ""),
    ]
    for name, research_question, hypothesis, description, status, input_value, dataset, metrics, result in experiments:
        conn.execute(
            """INSERT INTO experiments (project_id,name,research_question,hypothesis,description,status,input,dataset,metrics,result,notes,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (project_id,name,research_question,hypothesis,description,status,input_value,dataset,dumps(metrics),result,"",timestamp),
        )
    task_titles = [
        ("确认研究问题与评价指标", "Research Question", 1),
        ("扩展并筛选真实文献", "Literature Search", 1),
        ("完成核心论文证据提取", "Evidence Matrix", 1),
        ("核验 Research Gap 的来源", "Research Gap", 1),
        ("执行 RAG 对照实验", "Research Design", 0),
        ("上传并分析完整实验结果", "Analysis", 0),
        ("依据证据完善 Results", "Manuscript", 0),
    ]
    for title, phase, done in task_titles:
        conn.execute("INSERT INTO tasks (project_id,title,phase,done) VALUES (?,?,?,?)", (project_id,title,phase,done))
    sections = {
        "Abstract": "本研究评估检索增强生成在大语言模型代码漏洞检测中的作用。当前内容为项目草稿；定量结论须在 Experiment 2 完成后更新。",
        "Introduction": "大语言模型为自动化代码审查提供了新的技术路径，但其判断可能缺少可追溯的安全知识依据。检索增强生成（RAG）为引入外部漏洞知识提供了可行机制 [Paper 1]。",
        "Related Work": "项目文献库将相关工作划分为通用 RAG、基于 LLM 的漏洞检测与知识增强代码分析三类。Demo/sample 文献不可直接用于正式引用。",
        "Method": "我们设计 Baseline LLM 与 LLM + RAG 的配对对照，并按 CWE 类别报告 Precision、Recall 与 F1。",
        "Experiments": "实验使用固定提示、相同测试样本和预先构建的安全知识库，以减少非检索因素的影响。",
        "Results": "当前仅有演示结果。该陈述当前缺少已完成实验的项目证据。",
        "Discussion": "需重点分析召回率提升与误报增加之间的权衡，并追踪到具体检索证据。",
        "Conclusion": "结论将在实验完成并核验证据后撰写。",
    }
    for section, content in sections.items():
        conn.execute("INSERT INTO manuscripts (project_id,section,content,updated_at) VALUES (?,?,?,?)", (project_id,section,content,timestamp))
