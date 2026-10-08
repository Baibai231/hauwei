from __future__ import annotations

from typing import Any


PHASES = [
    ("Research Question", "research_question"),
    ("Literature Search", "literature"),
    ("Literature Screening", "screening"),
    ("Evidence Matrix", "evidence"),
    ("Research Gap", "gap"),
    ("Research Design", "design"),
    ("Experiments", "experiments"),
    ("Analysis", "analysis"),
    ("Manuscript", "writing"),
]


# Bilingual next-action messages. `reason` may contain {placeholder} fields.
MESSAGES: dict[str, dict[str, dict[str, str]]] = {
    "research_question": {
        "en": {
            "title": "Define Research Question",
            "reason": "The research idea is not yet a testable question.",
            "instruction": "Run the Research Planner and confirm the research questions.",
        },
        "zh": {
            "title": "确定研究问题",
            "reason": "研究想法尚未转化为可验证问题。",
            "instruction": "运行 Research Planner 并确认研究问题。",
        },
    },
    "literature": {
        "en": {
            "title": "Expand Literature Search",
            "reason": "Only {papers} papers in the project; evidence coverage is thin.",
            "instruction": "Search OpenAlex and add at least 5 related papers.",
        },
        "zh": {
            "title": "扩展文献检索",
            "reason": "项目中仅有 {papers} 篇文献，证据覆盖不足。",
            "instruction": "使用 OpenAlex 搜索并添加至少 5 篇相关文献。",
        },
    },
    "screening": {
        "en": {
            "title": "Screen Core Papers",
            "reason": "Only {core} of {papers} papers are marked as core.",
            "instruction": "Read and mark at least 3 core papers.",
        },
        "zh": {
            "title": "筛选核心论文",
            "reason": "{papers} 篇文献中仅 {core} 篇标记为核心。",
            "instruction": "精读并标记至少 3 篇核心论文。",
        },
    },
    "evidence": {
        "en": {
            "title": "Extract Evidence",
            "reason": "{core} core papers only have {evidence} structured evidence rows.",
            "instruction": "Extract method, data, results and limitations from the core papers.",
        },
        "zh": {
            "title": "提取结构化证据",
            "reason": "{core} 篇核心论文只有 {evidence} 条结构化证据。",
            "instruction": "从核心论文提取方法、数据、结果与局限。",
        },
    },
    "gap": {
        "en": {
            "title": "Analyze Research Gap",
            "reason": "An evidence matrix exists, but there is no traceable research gap yet.",
            "instruction": "Run gap analysis over the evidence and contradictions.",
        },
        "zh": {
            "title": "分析研究空白",
            "reason": "已有证据矩阵，但尚未形成可追溯的研究空白。",
            "instruction": "基于证据和矛盾关系运行 Gap Agent。",
        },
    },
    "design": {
        "en": {
            "title": "Create Research Design",
            "reason": "The research gap is clear, but there are no executable experiments.",
            "instruction": "Turn the research hypotheses into controlled experiments.",
        },
        "zh": {
            "title": "创建研究设计",
            "reason": "Research Gap 已明确，但尚无可执行实验。",
            "instruction": "把研究假设转化为对照实验。",
        },
    },
    "experiments": {
        "en": {
            "title": "Run Next Experiment",
            "reason": "{completed}/{experiments} experiments completed.",
            "instruction": "Run a Ready experiment and upload its results.",
        },
        "zh": {
            "title": "执行下一个实验",
            "reason": "已完成 {completed}/{experiments} 个实验。",
            "instruction": "执行 Ready 状态实验并上传结果。",
        },
    },
    "analysis": {
        "en": {
            "title": "Analyze Results",
            "reason": "Experiments are done, but there is no statistical analysis yet.",
            "instruction": "Upload the result file and run the Python data analysis.",
        },
        "zh": {
            "title": "分析实验结果",
            "reason": "实验已完成，但尚无统计分析记录。",
            "instruction": "上传结果文件并运行 Python 数据分析。",
        },
    },
    "writing": {
        "en": {
            "title": "Complete Manuscript",
            "reason": "Analysis is done, but the manuscript sections are incomplete.",
            "instruction": "Use the project evidence to complete the remaining sections.",
        },
        "zh": {
            "title": "完善论文写作",
            "reason": "分析已完成，论文各章节仍不完整。",
            "instruction": "使用项目证据辅助完善对应章节。",
        },
    },
    "complete": {
        "en": {
            "title": "Verify Evidence & Citations",
            "reason": "Every research stage is covered.",
            "instruction": "Verify each conclusion, citation and experiment output.",
        },
        "zh": {
            "title": "核验证据与引用",
            "reason": "科研流程已覆盖全部阶段。",
            "instruction": "逐项核验每个结论、引用和实验输出。",
        },
    },
}


def determine_next_action(state: dict[str, Any], lang: str = "en") -> dict[str, Any]:
    rq = state.get("research_questions") or []
    papers = int(state.get("paper_count", 0))
    core = int(state.get("core_paper_count", 0))
    evidence = int(state.get("evidence_count", 0))
    gap = (state.get("research_gap") or "").strip()
    experiments = int(state.get("experiment_count", 0))
    completed = int(state.get("completed_experiment_count", 0))
    analyses = int(state.get("analysis_count", 0))
    manuscript = int(state.get("manuscript_filled", 0))

    if not rq:
        return action("research_question", 8, lang)
    if papers < 5:
        return action("literature", 18, lang, papers=papers)
    if core < 3:
        return action("screening", 30, lang, papers=papers, core=core)
    if evidence < core:
        return action("evidence", 42, lang, core=core, evidence=evidence)
    if not gap:
        return action("gap", 54, lang)
    if experiments == 0:
        return action("design", 64, lang)
    if completed < experiments:
        return action("experiments", 72, lang, completed=completed, experiments=experiments)
    if analyses == 0:
        return action("analysis", 84, lang)
    if manuscript < 8:
        return action("writing", 92, lang)
    return action("complete", 100, lang)


def action(stage: str, progress: int, lang: str = "en", **params: Any) -> dict[str, Any]:
    variant = MESSAGES[stage]
    message = variant.get(lang) or variant["en"]
    return {
        "stage": stage,
        "title": message["title"],
        "reason": message["reason"].format(**params),
        "instruction": message["instruction"],
        "progress": progress,
    }
