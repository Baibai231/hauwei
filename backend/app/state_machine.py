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


def determine_next_action(state: dict[str, Any]) -> dict[str, Any]:
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
        return action("research_question", "Define Research Question", "研究想法尚未转化为可验证问题。", "运行 Research Planner 并确认研究问题。", 8)
    if papers < 5:
        return action("literature", "Expand Literature Search", f"项目中仅有 {papers} 篇文献，证据覆盖不足。", "使用 OpenAlex 搜索并添加至少 5 篇相关文献。", 18)
    if core < 3:
        return action("screening", "Screen Core Papers", f"{papers} 篇文献中仅 {core} 篇标记为核心。", "精读并标记至少 3 篇核心论文。", 30)
    if evidence < core:
        return action("evidence", "Extract Evidence", f"{core} 篇核心论文只有 {evidence} 条结构化证据。", "从核心论文提取方法、数据、结果与局限。", 42)
    if not gap:
        return action("gap", "Analyze Research Gap", "已有证据矩阵，但尚未形成可追溯的研究空白。", "基于证据和矛盾关系运行 Gap Agent。", 54)
    if experiments == 0:
        return action("design", "Create Research Design", "Research Gap 已明确，但尚无可执行实验。", "把研究假设转化为对照实验。", 64)
    if completed < experiments:
        return action("experiments", "Run Next Experiment", f"已完成 {completed}/{experiments} 个实验。", "执行 Ready 状态实验并上传结果。", 72)
    if analyses == 0:
        return action("analysis", "Analyze Results", "实验已完成，但尚无统计分析记录。", "上传结果文件并运行 Python 数据分析。", 84)
    if manuscript < 8:
        return action("writing", "Complete Manuscript", "分析已完成，论文各章节仍不完整。", "使用项目证据辅助完善对应章节。", 92)
    return action("complete", "Verify Evidence & Citations", "科研流程已覆盖全部阶段。", "逐项核验每个结论、引用和实验输出。", 100)


def action(stage: str, title: str, reason: str, instruction: str, progress: int) -> dict[str, Any]:
    return {"stage": stage, "title": title, "reason": reason, "instruction": instruction, "progress": progress}
