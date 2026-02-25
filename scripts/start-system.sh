#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting AgentLand Observability System..."

# Auto-backup database before starting
DB_PATH="$PROJECT_ROOT/apps/server/events.db"
BACKUP_DIR="$PROJECT_ROOT/backups"
if [[ -f "$DB_PATH" ]]; then
  mkdir -p "$BACKUP_DIR"
  ts=$(date +%Y-%m-%d_%H%M%S)
  cp "$DB_PATH" "$BACKUP_DIR/events-auto-${ts}.db"
  echo "Auto-backup → backups/events-auto-${ts}.db"

  # Keep only the 5 most recent auto-backups
  ls -t "$BACKUP_DIR"/events-auto-*.db 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
fi

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
