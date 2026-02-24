#!/bin/bash
set -e

echo "Stopping all processes..."

# Kill any running bun/node processes on known ports
lsof -ti:4000 2>/dev/null | xargs -r kill 2>/dev/null || true
lsof -ti:5173 2>/dev/null | xargs -r kill 2>/dev/null || true

echo "Done."
