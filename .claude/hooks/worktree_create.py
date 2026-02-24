#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""WorktreeCreate hook."""
from send_event import send_event

if __name__ == "__main__":
    send_event("WorktreeCreate")
