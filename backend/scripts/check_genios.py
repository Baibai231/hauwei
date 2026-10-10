"""Probe which NK-GeniOS / Coze chat endpoint answers with the configured credentials.

Run from the project root:

    .venv\\Scripts\\python.exe backend\\scripts\\check_genios.py

The script only reads .env; it never prints the API key.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import llm  # noqa: E402
from app.config import (  # noqa: E402
    GENIOS_AGENT_ID,
    GENIOS_API_KEY,
    GENIOS_BASE_URL,
    GENIOS_CHAT_PATH,
    LLM_BASE_URL,
    LLM_MODEL,
)


def recommendation(label: str, url: str) -> list[str]:
    """Suggest the exact .env lines for whichever endpoint shape answered."""
    if label == "base + Bearer header":
        return [
            "AI_PROVIDER=coze",
            f"GENIOS_BASE_URL={GENIOS_BASE_URL}",
            "GENIOS_API_KEY=<平台上的 API 密钥>",
            f"GENIOS_AGENT_ID={GENIOS_AGENT_ID}",
            'GENIOS_CHAT_PATH=-   # "-" 表示直接 POST 基地址，不追加路径',
        ]
    if label.startswith("base + api_key query"):
        return [
            "AI_PROVIDER=coze",
            f"GENIOS_BASE_URL={GENIOS_BASE_URL}",
            "GENIOS_API_KEY=<平台上的 API 密钥>",
            f"GENIOS_AGENT_ID={GENIOS_AGENT_ID}",
            'GENIOS_CHAT_PATH=-   # "-" 表示直接 POST 基地址，不追加路径',
            "GENIOS_API_KEY_PARAM=api_key",
        ]
    if label.startswith("coze-v3"):
        path = url.split(GENIOS_BASE_URL, 1)[-1] or GENIOS_CHAT_PATH
        return [
            "AI_PROVIDER=coze",
            f"GENIOS_BASE_URL={GENIOS_BASE_URL}",
            "GENIOS_API_KEY=<平台上的 API 密钥>",
            f"GENIOS_AGENT_ID={GENIOS_AGENT_ID}",
            f"GENIOS_CHAT_PATH={path}",
        ]
    if label == "openai-compatible":
        return [
            "AI_PROVIDER=openai",
            f"LLM_BASE_URL={GENIOS_BASE_URL}",
            "LLM_API_KEY=<平台上的 API 密钥，与 GENIOS_API_KEY 是同一个值>",
            f"LLM_MODEL={GENIOS_AGENT_ID}",
        ]
    return [
        "这个接口形态当前客户端还没有实现。",
        "请把平台「接口说明」里的请求示例（路径 / 方法 / 请求头 / 请求体）发给我，我来适配。",
    ]


def main() -> int:
    print("== ScholarFlow GeniOS connection check ==")
    print(f"AI_PROVIDER      : {llm.active_provider()}")
    print(f"GENIOS_BASE_URL  : {GENIOS_BASE_URL or '(empty)'}")
    print(f"GENIOS_CHAT_PATH : {GENIOS_CHAT_PATH}")
    print(f"GENIOS_AGENT_ID  : {GENIOS_AGENT_ID or '(empty)'}")
    print(f"GENIOS_API_KEY   : {'set' if GENIOS_API_KEY else '(empty)'}")
    print(f"LLM_BASE_URL     : {LLM_BASE_URL or '(empty)'}")
    print(f"LLM_MODEL        : {LLM_MODEL or '(empty)'}")
    print()

    if not GENIOS_BASE_URL or not GENIOS_API_KEY:
        print("Fill GENIOS_BASE_URL and GENIOS_API_KEY in .env first, then run this again.")
        return 2

    results = llm.probe_endpoints()
    working: dict | None = None
    for item in results:
        status = item.get("status")
        mark = ""
        if isinstance(status, int) and 200 <= status < 300:
            mark = "  <== looks usable"
            if working is None:
                working = item
        elif status in (401, 403):
            mark = "  (reached the service, credentials rejected)"
        elif status == 404:
            mark = "  (endpoint not found)"
        print(f"[{status}] {item['label']}")
        print(f"      url : {item['url']}")
        if item.get("error"):
            print(f"      err : {item['error']}")
        elif item.get("body"):
            print(f"      body: {item['body']}")
        if item.get("location"):
            print(f"      ->  : {item['location'][:120]}")

    print()
    if working:
        print(f"可用接口形态：{working['label']}")
        print("请把下面几行写进 .env（其余行保持不动）：")
        print("-" * 52)
        for line in recommendation(working["label"], working["url"]):
            print(line)
        print("-" * 52)
        print("然后重启后端：.\\start.ps1，打开 Settings 页确认状态为“已连接”。")
        return 0
    print("No endpoint returned 2xx. Open the platform's '接口说明' page and compare the request path, method and body.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
