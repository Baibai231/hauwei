"""Local-browser bridge for the NK-GeniOS web app.

The Nankai deployment protects ``/api/*`` with campus SSO, so a server-to-server
call cannot work with just an API key. Instead of storing campus credentials,
this module reuses an already-authenticated Edge/Chrome window through the local
Chrome DevTools Protocol (CDP) port and drives the published chat UI.

Security notes:
* No password, cookie or API key is read or stored here.
* CDP must stay bound to 127.0.0.1, and the browser window should be closed when
  the demo is over: while it is open any local process could drive that session.
"""

from __future__ import annotations

import json
import time
from typing import Any

import httpx

from .config import (
    BROWSER_CDP_URL,
    BROWSER_CHAT_URL,
    BROWSER_NEW_CONVERSATION,
    BROWSER_TARGET_HOST,
    BROWSER_TIMEOUT_SECONDS,
)

LOGIN_HOST_MARKERS = ("iam.nankai.edu.cn", "/login")

_JS_EDITOR_READY = """(() => {
  const ed = document.querySelector('[contenteditable="true"]');
  if (!ed) return false;
  ed.focus();
  const range = document.createRange();
  range.selectNodeContents(ed);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('delete', false, null);
  return true;
})()"""

_JS_CLICK_SEND = """(() => {
  const btn = document.querySelector('[class*="send-button"]');
  if (!btn) return false;
  if ((btn.className || '').toString().includes('disabled')) return false;
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
})()"""

_JS_NEW_CONVERSATION = """(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => (b.textContent || '').includes('新增会话'));
  if (!btn) return false;
  btn.click();
  return true;
})()"""

_JS_STATE = """(() => {
  const items = [...document.querySelectorAll('[class*="messageAIWrapper"]')];
  const loading = document.querySelector('[class*="message-loading"]');
  // The chat app appends an empty AI card (footer only: "0.58s , 1703 Tokens")
  // after the real answer, so scan backwards for the last card WITH content.
  let paraCount = 0;
  let text = '';
  for (let i = items.length - 1; i >= 0; i--) {
    const paragraphs = [...items[i].querySelectorAll('.paragraph-element')]
      .map(p => (p.innerText || '').trim())
      .filter(Boolean);
    paraCount += paragraphs.length;
    if (!text && paragraphs.length) text = paragraphs.join('\\n');
  }
  return JSON.stringify({
    count: items.length,
    paraCount: paraCount,
    text: text,
    busy: loading ? Boolean(loading.offsetParent) : false
  });
})()"""


def _targets(timeout: float = 5.0) -> list[dict[str, Any]]:
    with httpx.Client(timeout=timeout) as client:
        response = client.get(f"{BROWSER_CDP_URL}/json/list")
        response.raise_for_status()
        return response.json()


def _pick_target(timeout: float = 5.0) -> dict[str, Any] | None:
    pages = [item for item in _targets(timeout) if item.get("type") == "page"]
    for item in pages:
        if BROWSER_TARGET_HOST in (item.get("url") or ""):
            return item
    return None


def _call(ws: Any, message_id: int, method: str, params: dict[str, Any], timeout: float) -> dict[str, Any]:
    ws.send(json.dumps({"id": message_id, "method": method, "params": params}))
    while True:
        message = json.loads(ws.recv(timeout=timeout))
        if message.get("id") == message_id:
            return message


def _command(method: str, params: dict[str, Any], timeout: float = 60.0) -> dict[str, Any]:
    from websockets.sync.client import connect  # lazy: app still runs without the bridge

    target = _pick_target()
    if not target:
        raise RuntimeError("no browser page target found")
    with connect(target["webSocketDebuggerUrl"], open_timeout=5, max_size=None, close_timeout=5) as ws:
        return _call(ws, 1, method, params, timeout)


def evaluate(expression: str, timeout: float = 60.0) -> Any:
    """Run JavaScript in the authenticated page and return its value."""
    message = _command("Runtime.evaluate", {
        "expression": expression,
        "awaitPromise": True,
        "returnByValue": True,
    }, timeout)
    return message.get("result", {}).get("result", {}).get("value")


def status() -> dict[str, Any]:
    """Report whether CDP is reachable and the target page is still logged in."""
    try:
        target = _pick_target()
    except Exception as exc:  # noqa: BLE001 - surfaced as a status string
        return {"cdp_available": False, "logged_in": False, "error": f"CDP unreachable: {exc}"}
    if not target:
        return {"cdp_available": True, "logged_in": False, "error": "no browser page target found"}
    url = target.get("url") or ""
    logged_in = not any(marker in url for marker in LOGIN_HOST_MARKERS)
    return {
        "cdp_available": True,
        "logged_in": logged_in,
        "url": url[:160],
        "title": (target.get("title") or "")[:80],
    }


def open_chat() -> bool:
    """Make sure the bridge tab is on the published chat page."""
    info = status()
    if not info.get("cdp_available"):
        return False
    current = info.get("url") or ""
    if BROWSER_CHAT_URL.split("?")[0] in current:
        return True
    try:
        _command("Page.navigate", {"url": BROWSER_CHAT_URL}, 30)
    except Exception:  # noqa: BLE001
        return False
    time.sleep(6)
    return bool(status().get("logged_in"))


def _state() -> dict[str, Any] | None:
    try:
        raw = evaluate(_JS_STATE, 30)
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(raw, str):
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def complete(system: str, user: str, timeout: float | None = None) -> str | None:
    """Ask the NK-GeniOS agent through the logged-in browser tab.

    Returns the agent's answer text, or None when the bridge is unavailable so the
    caller can fall back to the deterministic rules.
    """
    budget = timeout or BROWSER_TIMEOUT_SECONDS
    if not status().get("logged_in"):
        return None
    if not open_chat():
        return None

    prompt = f"{system}\n\n{user}"
    if BROWSER_NEW_CONVERSATION:
        try:
            evaluate(_JS_NEW_CONVERSATION, 20)
            time.sleep(2.5)
        except Exception:  # noqa: BLE001
            pass

    before = _state() or {}
    baseline = int(before.get("paraCount") or 0)

    try:
        if not evaluate(_JS_EDITOR_READY, 20):
            return None
        _command("Input.insertText", {"text": prompt}, 30)
        time.sleep(0.6)
        if not evaluate(_JS_CLICK_SEND, 20):
            return None
    except Exception:  # noqa: BLE001
        return None

    deadline = time.monotonic() + budget
    last_text = ""
    stable = 0
    while time.monotonic() < deadline:
        time.sleep(2.5)
        state = _state()
        if not state:
            continue
        text = str(state.get("text") or "").strip()
        if int(state.get("paraCount") or 0) > baseline and text:
            if text == last_text and not state.get("busy"):
                stable += 1
                if stable >= 2:
                    return text
            else:
                last_text = text
                stable = 0
    return last_text or None
