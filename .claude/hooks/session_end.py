#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""SessionEnd hook — sends event and ingests session transcript."""
import json
import os
import sys

import requests

SERVER_URL = os.environ.get("OBSERVABILITY_SERVER_URL", "http://localhost:4000")


def send_event_inline(data: dict, session_id: str, source_app: str) -> None:
    """Send the SessionEnd event to the server."""
    payload = data if isinstance(data, dict) else {"raw": data}
    event = {
        "source_app": source_app,
        "session_id": session_id,
        "hook_event_type": "SessionEnd",
        "payload": payload,
        "timestamp": None,
    }
    try:
        requests.post(f"{SERVER_URL}/events", json=event, timeout=2)
    except Exception:
        pass


def ingest_transcript(session_id: str, source_app: str, cwd: str) -> None:
    """Read the .jsonl transcript and POST messages to /transcripts."""
    # Build the path: ~/.claude/projects/-{cwd-with-slashes-replaced}/{session_id}.jsonl
    cwd_dashed = cwd.replace("/", "-")
    jsonl_path = os.path.expanduser(f"~/.claude/projects/{cwd_dashed}/{session_id}.jsonl")

    if not os.path.exists(jsonl_path):
        return

    messages = []
    try:
        with open(jsonl_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    continue

                record_type = record.get("type")
                if record_type not in ("user", "assistant"):
                    continue

                msg = record.get("message", {})
                role = msg.get("role")
                if role not in ("user", "assistant"):
                    continue

                uuid = record.get("uuid")
                timestamp = record.get("timestamp")
                if not uuid or not timestamp:
                    continue

                # Extract text content
                raw_content = msg.get("content", "")
                text_parts = []
                thinking_parts = []

                if isinstance(raw_content, str):
                    text_parts.append(raw_content)
                elif isinstance(raw_content, list):
                    for block in raw_content:
                        if isinstance(block, dict):
                            if block.get("type") == "text":
                                text_parts.append(block.get("text", ""))
                            elif block.get("type") == "thinking":
                                thinking_parts.append(block.get("thinking", ""))
                        elif isinstance(block, str):
                            text_parts.append(block)

                content = "\n\n".join(text_parts).strip()
                if not content:
                    continue

                thinking = "\n\n".join(thinking_parts).strip() or None

                message_data = {
                    "session_id": session_id,
                    "source_app": source_app,
                    "role": role,
                    "content": content,
                    "thinking": thinking,
                    "model": msg.get("model") if role == "assistant" else None,
                    "timestamp": timestamp,
                    "uuid": uuid,
                }

                # Token usage (assistant only)
                usage = msg.get("usage", {})
                if role == "assistant" and usage:
                    message_data["input_tokens"] = usage.get("input_tokens")
                    message_data["output_tokens"] = usage.get("output_tokens")

                messages.append(message_data)
    except Exception:
        return

    if not messages:
        return

    try:
        requests.post(
            f"{SERVER_URL}/transcripts",
            json={"messages": messages},
            timeout=10,
        )
    except Exception:
        pass


if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, Exception):
        sys.exit(0)

    session_id = data.get("session_id", "unknown")
    source_app = os.environ.get("CLAUDE_SOURCE_APP", "claude-code")
    cwd = data.get("cwd", os.getcwd())

    # 1. Send the SessionEnd event
    send_event_inline(data, session_id, source_app)

    # 2. Ingest the transcript
    ingest_transcript(session_id, source_app, cwd)
