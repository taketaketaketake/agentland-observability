#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting Multi-Agent Observability System..."

# Start server
echo "Starting server..."
cd "$PROJECT_ROOT/apps/server"
bun run dev &
SERVER_PID=$!

# Wait for server to be ready
sleep 2

# Start client
echo "Starting client..."
cd "$PROJECT_ROOT/apps/client"
bun run dev &
CLIENT_PID=$!

echo ""
echo "System started!"
echo "  Server: http://localhost:${SERVER_PORT:-4000}"
echo "  Client: http://localhost:${VITE_PORT:-5173}"
echo ""
echo "Press Ctrl+C to stop."

# Trap Ctrl+C to kill both processes
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM

# Wait for either process to exit
wait
