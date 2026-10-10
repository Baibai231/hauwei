"""Prompt layer for the AI-backed research features.

Every helper returns ``None`` when no provider is configured or the call fails,
so the caller can fall back to the deterministic rules. Nothing here invents
data: the model only reorganises material supplied by the caller.
"""

from __future__ import annotations

import json
import re
from typing import Any

from . import llm

_LANG_NAME = {"zh": "简体中文", "en": "English"}

_BASE_SYSTEM = (
    "你是 ScholarFlow 科研助手，服务大学生科研项目。"
    "只能依据用户消息中提供的材料作答，严禁编造论文标题、作者、DOI、链接、样本量、实验数据或引用。"
    "无法从材料确认的字段写“未提供”。把作者报告的结果与待验证假设明确区分。"
)

# JSON-shaped answers for the structured features…
SYSTEM = _BASE_SYSTEM + "严格按用户要求的 JSON 结构输出，不要输出多余解释。"
# …and plain prose for answers that are shown verbatim to the user.
SYSTEM_TEXT = _BASE_SYSTEM + "直接输出正文内容，不要输出 JSON、代码块或额外说明。"


def _lang(lang: str | None) -> str:
    return _LANG_NAME.get((lang or "zh").lower(), _LANG_NAME["zh"])


# The platform agent appends its own "当前阶段 / 下一步行动 / 验收条件" footer to
# every reply; it is useful in chat but noise inside a manuscript draft.
_FOOTER_LINE = re.compile(r"^\s*(?:当前阶段|下一步行动|验收条件)\s*[:：]")
_FOOTER_HINT = "当前阶段 / 下一步行动 / 验收条件"


def _strip_agent_footer(text: str) -> str:
    kept = []
    for line in text.splitlines():
        if _FOOTER_LINE.match(line) or _FOOTER_HINT in line:
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def _unwrap_text(text: str) -> str:
    """Unwrap a ``{"field": "..."}`` reply when the model JSON-wrapped prose."""
    cleaned = text.strip()
    if not (cleaned.startswith("{") and cleaned.endswith("}")):
        return text
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return text
    if isinstance(data, dict):
        for value in data.values():
            if isinstance(value, str) and value.strip():
                return value.strip()
    return text


def _json_call(user: str, lang: str | None) -> dict[str, Any] | None:
    if not llm.configured():
        return None
    return llm.complete_json(f"{SYSTEM}\n输出语言：{_lang(lang)}。", user)


def research_plan(topic: str, project: dict[str, Any], lang: str | None = None) -> dict[str, Any] | None:
    user = (
        "根据下面的研究想法，输出研究计划。\n"
        f"研究想法：{topic}\n"
        f"项目名称：{project.get('name')}\n"
        f"研究方向：{project.get('direction') or '未提供'}\n"
        f"补充说明：{project.get('description') or '未提供'}\n\n"
        "只输出 JSON：{\"objective\": string, \"research_questions\": string[3], "
        "\"keywords\": string[最多8], \"hypotheses\": string[2], "
        "\"tasks\": string[5], \"scope\": string}。"
        "研究问题必须是可检验的问题，不要写成泛泛的口号。"
    )
    return _json_call(user, lang)


def gap_analysis(project: dict[str, Any], evidence: list[dict[str, Any]], claims: list[dict[str, Any]], lang: str | None = None) -> dict[str, Any] | None:
    rows = [
        {
            "paper": item.get("paper_title"),
            "problem": item.get("problem"),
            "method": item.get("method"),
            "result": item.get("result"),
            "limitation": item.get("limitation"),
            "confidence": item.get("confidence"),
        }
        for item in evidence[:20]
    ]
    user = (
        "根据以下项目证据，分析研究空白。\n"
        f"研究问题：{json.dumps(project.get('research_questions') or [], ensure_ascii=False)}\n"
        f"已有证据：{json.dumps(rows, ensure_ascii=False)}\n"
        f"已有论断：{json.dumps([c.get('text') for c in claims], ensure_ascii=False)}\n\n"
        "只输出 JSON：{\"gap\": string, \"contradictions\": string[1-3]}。"
        "gap 必须指出覆盖不足、矛盾或尚未验证之处，不要宣称创新。"
    )
    return _json_call(user, lang)


def evidence_fields(paper: dict[str, Any], text: str, lang: str | None = None) -> dict[str, Any] | None:
    user = (
        "从下面这篇论文的原文片段中抽取结构化证据。只使用片段中真实出现的信息。\n"
        f"标题：{paper.get('title')}\n"
        f"原文片段：\n{text[:6000]}\n\n"
        "只输出 JSON：{\"problem\": string, \"method\": string, \"dataset\": string, "
        "\"baseline\": string, \"metric\": string, \"result\": string, \"limitation\": string}。"
        "字段无法确认时填空字符串，不要猜测。"
    )
    return _json_call(user, lang)


def paper_answer(question: str, citations: list[dict[str, Any]], lang: str | None = None) -> str | None:
    if not llm.configured():
        return None
    material = "\n\n".join(f"[片段 {c.get('chunk')}] {c.get('snippet')}" for c in citations)
    user = (
        f"问题：{question}\n\n"
        f"论文片段：\n{material}\n\n"
        "请只依据上述片段回答，并在结论后用 [片段 N] 标注依据。"
        "片段不足以回答时明确说明“材料未提供”，不要补充外部知识。"
    )
    draft = llm.complete_text(f"{SYSTEM_TEXT}\n输出语言：{_lang(lang)}。", user)
    return _unwrap_text(_strip_agent_footer(draft)) if draft else None


def research_design(project: dict[str, Any], evidence_count: int, lang: str | None = None) -> dict[str, Any] | None:
    user = (
        "根据项目状态设计可复现的对照实验。数值与阈值都必须标为建议。\n"
        f"研究想法：{project.get('idea') or project.get('name')}\n"
        f"研究问题：{json.dumps(project.get('research_questions') or [], ensure_ascii=False)}\n"
        f"假设：{json.dumps(project.get('hypotheses') or [], ensure_ascii=False)}\n"
        f"研究空白：{project.get('research_gap') or '未提供'}\n"
        f"证据条数：{evidence_count}\n\n"
        "只输出 JSON：{\"hypothesis\": string, "
        "\"variables\": {\"independent\": string, \"dependent\": string[], \"controls\": string[]}, "
        "\"dataset\": string, \"baselines\": string[], \"metrics\": string[], \"risks\": string[], "
        "\"expected_output\": string, "
        "\"design_flow\": {\"control\": string, \"treatment\": string, \"evaluation\": string}}。"
    )
    return _json_call(user, lang)


def section_draft(section: str, evidence: list[dict[str, Any]], lang: str | None = None) -> str | None:
    if not llm.configured():
        return None
    rows = [
        {
            "paper_id": item.get("paper_id"),
            "evidence_id": item.get("id"),
            "method": item.get("method"),
            "result": item.get("result"),
            "limitation": item.get("limitation"),
        }
        for item in evidence[:10]
    ]
    user = (
        f"为论文的 {section} 章节起草一段草稿。\n"
        f"项目证据：{json.dumps(rows, ensure_ascii=False)}\n\n"
        "要求：只使用上述证据中出现的结论；每处引用证据的句子末尾标注 [Paper {paper_id}; Evidence {evidence_id}]；"
        "证据不足的论断必须明确写出“该陈述当前缺少项目文献证据”。不要编造引用。"
    )
    draft = llm.complete_text(f"{SYSTEM_TEXT}\n输出语言：{_lang(lang)}。", user)
    return _unwrap_text(_strip_agent_footer(draft)) if draft else None
