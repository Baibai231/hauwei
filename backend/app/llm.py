from __future__ import annotations

import json
from typing import Any

import httpx

from .config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL


def configured() -> bool:
    return bool(LLM_BASE_URL and LLM_API_KEY and LLM_MODEL)


async def complete_json(system: str, user: str) -> dict[str, Any] | None:
    if not configured():
        return None
    headers = {"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": LLM_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(f"{LLM_BASE_URL}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    except (httpx.HTTPError, KeyError, json.JSONDecodeError):
        return None
