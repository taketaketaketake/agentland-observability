#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""AfterTool hook (Gemini CLI) — maps to PostToolUse."""

import json
import os
import sys
import requests

SERVER_URL = os.environ.get("OBSERVABILITY_SERVER_URL", "http://localhost:4000")


def main() -> None:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return
        data = json.loads(raw)
    except (json.JSONDecodeError, Exception):
        return

    session_id = data.get("session_id", "unknown")
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})
    tool_response = data.get("tool_response")

    payload = {
        "tool_name": tool_name,
        "tool_input": tool_input,
    }
    if tool_response is not None:
        payload["tool_response"] = tool_response

    event = {
        "source_app": "gemini-cli",
        "session_id": session_id,
        "hook_event_type": "PostToolUse",
        "payload": payload,
    }

    try:
        requests.post(f"{SERVER_URL}/events", json=event, timeout=2)
    except Exception:
        pass


if __name__ == "__main__":
    main()
