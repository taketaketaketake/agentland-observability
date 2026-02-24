#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""PermissionRequest hook."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from send_event import send_event

if __name__ == "__main__":
    send_event("PermissionRequest")
