#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""PostToolUse hook: log tool completion events."""

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
    from send_event import get_source_app
    source_app = get_source_app(data.get("cwd"))
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    event = {
        "source_app": source_app,
        "session_id": session_id,
        "hook_event_type": "PostToolUse",
        "payload": {
            "tool_name": tool_name,
            "tool_input": tool_input,
            "cwd": data.get("cwd", ""),
        },
    }

    try:
        requests.post(f"{SERVER_URL}/events", json=event, timeout=2)
    except Exception:
        pass


if __name__ == "__main__":
    main()
