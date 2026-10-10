from __future__ import annotations

import json
import re
import time
from typing import Any

import httpx

from .config import (
    AI_PROVIDER,
    AI_TIMEOUT_SECONDS,
    GENIOS_AGENT_ID,
    GENIOS_API_KEY,
    GENIOS_API_KEY_PARAM,
    GENIOS_BASE_URL,
    GENIOS_CHAT_PATH,
    GENIOS_USER_ID,
    LLM_API_KEY,
    LLM_BASE_URL,
    LLM_MODEL,
)


def _coze_ready() -> bool:
    return bool(GENIOS_BASE_URL and GENIOS_API_KEY and GENIOS_AGENT_ID)


def _openai_ready() -> bool:
    return bool(LLM_BASE_URL and LLM_API_KEY and LLM_MODEL)


def _browser_ready() -> bool:
    try:
        from . import browser_bridge

        return bool(browser_bridge.status().get("logged_in"))
    except Exception:  # noqa: BLE001 - treat any failure as "not available"
        return False


def active_provider() -> str:
    """Return the provider that will actually be used.

    One of: "coze", "openai", "genios_browser" or "off".
    """
    if AI_PROVIDER == "off":
        return "off"
    if AI_PROVIDER == "genios_browser":
        # Only used when explicitly requested: it needs a logged-in local browser.
        return "genios_browser" if _browser_ready() else "off"
    if AI_PROVIDER == "coze":
        return "coze" if _coze_ready() else "off"
    if AI_PROVIDER == "openai":
        return "openai" if _openai_ready() else "off"
    # auto
    if _coze_ready():
        return "coze"
    if _openai_ready():
        return "openai"
    return "off"


def configured() -> bool:
    return active_provider() != "off"


def describe() -> dict[str, Any]:
    """Non-secret status used by /api/health and the Settings page."""
    provider = active_provider()
    info: dict[str, Any] = {
        "ai_provider": provider,
        "ai_configured": provider != "off",
        "openai_configured": _openai_ready(),
        "coze_configured": _coze_ready(),
        "genios_agent_id": GENIOS_AGENT_ID or None,
    }
    try:
        from . import browser_bridge

        info["browser_bridge"] = browser_bridge.status()
    except Exception:  # noqa: BLE001
        info["browser_bridge"] = {"cdp_available": False, "logged_in": False}
    return info


def _extract_json(text: str | None) -> dict[str, Any] | None:
    if not text:
        return None
    cleaned = text.strip()
    cleaned = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            parsed = json.loads(cleaned[start : end + 1])
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _openai_chat(system: str, user: str, json_mode: bool) -> str | None:
    payload: dict[str, Any] = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    headers = {"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=AI_TIMEOUT_SECONDS) as client:
            response = client.post(f"{LLM_BASE_URL}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        return None


def _coze_chat(system: str, user: str) -> str | None:
    """Call the NK-GeniOS / Coze OpenAPI (POST /v3/chat) in blocking mode."""
    base = GENIOS_BASE_URL
    chat_url = f"{base}{GENIOS_CHAT_PATH}"
    headers = {"Content-Type": "application/json"}
    query: dict[str, str] = {}
    if GENIOS_API_KEY_PARAM:
        query[GENIOS_API_KEY_PARAM] = GENIOS_API_KEY
    else:
        headers["Authorization"] = f"Bearer {GENIOS_API_KEY}"
    payload = {
        "bot_id": GENIOS_AGENT_ID,
        "user_id": GENIOS_USER_ID,
        "stream": False,
        "additional_messages": [
            {"role": "user", "content": f"{system}\n\n{user}", "content_type": "text"}
        ],
    }
    try:
        with httpx.Client(timeout=AI_TIMEOUT_SECONDS) as client:
            created = client.post(chat_url, headers=headers, params=query, json=payload)
            created.raise_for_status()
            data = created.json().get("data") or {}
            chat_id = data.get("id")
            conversation_id = data.get("conversation_id")
            status = data.get("status")
            if not chat_id or not conversation_id:
                return None
            deadline = time.monotonic() + AI_TIMEOUT_SECONDS
            while status == "in_progress" and time.monotonic() < deadline:
                time.sleep(1.5)
                poll = client.get(
                    f"{base}{GENIOS_CHAT_PATH}/retrieve",
                    headers=headers,
                    params={**query, "chat_id": chat_id, "conversation_id": conversation_id},
                )
                poll.raise_for_status()
                status = (poll.json().get("data") or {}).get("status")
            messages = client.get(
                f"{base}{GENIOS_CHAT_PATH}/message/list",
                headers=headers,
                params={**query, "chat_id": chat_id, "conversation_id": conversation_id},
            )
            messages.raise_for_status()
            for message in messages.json().get("data") or []:
                if message.get("role") == "assistant" and message.get("type") == "answer":
                    return message.get("content")
            return None
    except (httpx.HTTPError, KeyError, ValueError):
        return None


def complete_text(system: str, user: str) -> str | None:
    provider = active_provider()
    if provider == "genios_browser":
        from . import browser_bridge

        return browser_bridge.complete(system, user)
    if provider == "coze":
        return _coze_chat(system, user)
    if provider == "openai":
        return _openai_chat(system, user, json_mode=False)
    return None


def complete_json(system: str, user: str) -> dict[str, Any] | None:
    return _extract_json(complete_text(system, user))


def probe_endpoints() -> list[dict[str, Any]]:
    """Try the common NK-GeniOS / Coze chat shapes and report which one answers.

    Used by backend/scripts/check_genios.py so the exact path can be confirmed
    from live responses instead of guessing. Never prints the API key.
    """
    from urllib.parse import urlsplit

    base = GENIOS_BASE_URL
    origin = "{0.scheme}://{0.netloc}".format(urlsplit(base)) if base else ""
    bearer = {"Authorization": f"Bearer {GENIOS_API_KEY}", "Content-Type": "application/json"}
    plain = {"Content-Type": "application/json"}
    masked = "<API_KEY>"
    coze_body = {
        "bot_id": GENIOS_AGENT_ID,
        "user_id": GENIOS_USER_ID,
        "stream": False,
        "additional_messages": [{"role": "user", "content": "ping", "content_type": "text"}],
    }
    candidates = [
        ("base + Bearer header", base, base, bearer, coze_body),
        ("base + api_key query (like MCP)", f"{base}?api_key={GENIOS_API_KEY}", f"{base}?api_key={masked}", plain, coze_body),
        ("coze-v3 (GENIOS_CHAT_PATH)", f"{base}{GENIOS_CHAT_PATH}", f"{base}{GENIOS_CHAT_PATH}", bearer, coze_body),
        ("openai-compatible", f"{base}/chat/completions", f"{base}/chat/completions", bearer, {"model": GENIOS_AGENT_ID, "messages": [{"role": "user", "content": "ping"}]}),
        ("generic-chat", f"{base}/chat", f"{base}/chat", bearer, {"bot_id": GENIOS_AGENT_ID, "user_id": GENIOS_USER_ID, "query": "ping"}),
        ("coze-v2-open_api", f"{origin}/open_api/v2/chat", f"{origin}/open_api/v2/chat", bearer, {"bot_id": GENIOS_AGENT_ID, "user": GENIOS_USER_ID, "query": "ping", "stream": False}),
    ]
    results: list[dict[str, Any]] = []
    for label, request_url, display_url, headers, body in candidates:
        entry: dict[str, Any] = {"label": label, "url": display_url}
        try:
            with httpx.Client(timeout=30, follow_redirects=False) as client:
                response = client.post(request_url, headers=headers, json=body)
            entry["status"] = response.status_code
            location = response.headers.get("location")
            if location:
                entry["location"] = location
            entry["body"] = response.text[:240].replace("\n", " ")
        except httpx.HTTPError as exc:
            entry["status"] = None
            entry["error"] = str(exc)
        results.append(entry)
    return results
