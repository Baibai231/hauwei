"""Build an OpenAPI 3 document that contains only the GeniOS tool endpoints.

The platform imports tools from an OpenAPI schema, but the full FastAPI document
also lists the project-management endpoints. This module filters it down to the
13 tools (and gives them friendly operationIds) so an import cannot expose the
rest of the API.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import PROJECT_ROOT

TOOL_NAMES: dict[str, str] = {
    "/api/genios/project/create": "project_create",
    "/api/genios/project/status": "project_status",
    "/api/genios/research/plan": "research_plan",
    "/api/genios/literature/search": "literature_search",
    "/api/genios/literature/add": "literature_add",
    "/api/genios/paper/parse": "paper_parse",
    "/api/genios/paper/ask": "paper_ask",
    "/api/genios/evidence/extract": "evidence_extract",
    "/api/genios/gap/analyze": "gap_analyze",
    "/api/genios/research/design": "research_design",
    "/api/genios/data/analyze": "data_analyze",
    "/api/genios/writing/draft": "writing_draft",
    "/api/genios/project/next-action": "project_next_action",
}


def _tool_descriptions() -> dict[str, str]:
    path = Path(PROJECT_ROOT) / "genios" / "tools.json"
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return {
        str(tool.get("name")): str(tool.get("description") or "")
        for tool in data.get("tools", [])
        if tool.get("name")
    }


def build_spec(app: Any, base_url: str) -> dict[str, Any]:
    source = app.openapi()
    descriptions = _tool_descriptions()
    paths: dict[str, Any] = {}
    for path, item in source.get("paths", {}).items():
        tool_name = TOOL_NAMES.get(path)
        if not tool_name:
            continue
        entry: dict[str, Any] = {}
        for method, operation in item.items():
            if method.lower() not in {"post", "get"}:
                continue
            op = dict(operation)
            op["operationId"] = tool_name
            if descriptions.get(tool_name):
                op["summary"] = descriptions[tool_name]
                op["description"] = descriptions[tool_name]
            op.setdefault("security", [{"bearerAuth": []}])
            entry[method] = op
        if entry:
            paths[path] = entry

    components = dict(source.get("components", {}))
    schemes = dict(components.get("securitySchemes", {}))
    schemes["bearerAuth"] = {"type": "http", "scheme": "bearer"}
    components["securitySchemes"] = schemes

    return {
        "openapi": "3.0.3",
        "info": {
            "title": "ScholarFlow GeniOS Tools",
            "version": "1.0.0",
            "description": (
                "ScholarFlow 科研状态与工具接口。调用时请带上 "
                "Authorization: Bearer <GENIOS_TOOL_TOKEN>。"
            ),
        },
        "servers": [{"url": base_url}],
        "security": [{"bearerAuth": []}],
        "paths": paths,
        "components": components,
    }
