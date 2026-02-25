# Multi-Agent Observability System (React)
# Usage: just <recipe>

set dotenv-load
set quiet

server_port := env("SERVER_PORT", "4000")
client_port := env("CLIENT_PORT", "5173")
project_root := justfile_directory()

default:
    @just --list

# --- System ---

start:
    ./scripts/start-system.sh

stop:
    ./scripts/reset-system.sh

restart: stop start

# --- Server (Bun, port 4000) ---

server-install:
    cd {{project_root}}/apps/server && bun install

server:
    cd {{project_root}}/apps/server && SERVER_PORT={{server_port}} bun run dev

server-prod:
    cd {{project_root}}/apps/server && SERVER_PORT={{server_port}} bun run start

# --- Client (React + Vite, port 5173) ---

client-install:
    cd {{project_root}}/apps/client && bun install

client:
    cd {{project_root}}/apps/client && VITE_PORT={{client_port}} bun run dev

client-build:
    cd {{project_root}}/apps/client && bun run build

# --- Install ---

install: server-install client-install

# --- Database ---

db-reset:
    rm -f {{project_root}}/apps/server/events.db {{project_root}}/apps/server/events.db-wal {{project_root}}/apps/server/events.db-shm
    @echo "Database reset"

# --- Testing ---

test:
    cd {{project_root}}/apps/server && bun test

test-e2e:
    cd {{project_root}}/apps/client && bunx playwright test

test-all: test test-e2e

test-event:
    curl -s -X POST http://localhost:{{server_port}}/events \
      -H "Content-Type: application/json" \
      -d '{"source_app":"test","session_id":"test-1234","hook_event_type":"PreToolUse","payload":{"tool_name":"Bash","tool_input":{"command":"echo hello"}}}' \
      | head -c 200
    @echo ""

# --- Git Hooks ---

setup-githooks:
    git config core.hooksPath .githooks
    chmod +x .githooks/*
    @echo "Git hooks configured (core.hooksPath=.githooks)"

test-git-event:
    curl -s -X POST http://localhost:{{server_port}}/events \
      -H "Content-Type: application/json" \
      -d '{"source_app":"git","session_id":"test-git-00000000000000000000000000","hook_event_type":"GitPostCommit","summary":"Committed: Test commit message (abc1234)","payload":{"branch":"main","commit_hash":"abc1234567890","commit_short":"abc1234","commit_message":"Test commit message","author":"Test User <test@example.com>","changed_file_count":3,"insertions":42,"deletions":7,"claude_session_id":""}}' \
      | head -c 200
    @echo ""

# --- Open ---

open:
    open http://localhost:{{client_port}}
