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

db_path := project_root / "apps/server/events.db"
backup_dir := project_root / "backups"

db-reset:
    rm -f {{project_root}}/apps/server/events.db {{project_root}}/apps/server/events.db-wal {{project_root}}/apps/server/events.db-shm
    @echo "Database reset"

# Save a named snapshot: just db-backup "before-migration"
db-backup tag="":
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p "{{backup_dir}}"
    ts=$(date +%Y-%m-%d_%H%M%S)
    if [[ -n "{{tag}}" ]]; then
      name="events-{{tag}}-${ts}.db"
    else
      name="events-${ts}.db"
    fi
    if [[ ! -f "{{db_path}}" ]]; then
      echo "No database found at {{db_path}}"
      exit 1
    fi
    cp "{{db_path}}" "{{backup_dir}}/${name}"
    echo "Backed up → backups/${name}"

# List available backups
db-list:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -d "{{backup_dir}}" ]] || [[ -z "$(ls -A "{{backup_dir}}" 2>/dev/null)" ]]; then
      echo "No backups found"
      exit 0
    fi
    echo "Available backups:"
    for f in "{{backup_dir}}"/*.db; do
      size=$(du -h "$f" | cut -f1)
      echo "  $(basename "$f")  (${size})"
    done

# Restore a backup: just db-restore "events-clean-data-2025-02-25_143000.db"
db-restore name:
    #!/usr/bin/env bash
    set -euo pipefail
    src="{{backup_dir}}/{{name}}"
    if [[ ! -f "$src" ]]; then
      echo "Backup not found: $src"
      echo "Run 'just db-list' to see available backups"
      exit 1
    fi
    # Auto-backup current db before restoring
    if [[ -f "{{db_path}}" ]]; then
      mkdir -p "{{backup_dir}}"
      ts=$(date +%Y-%m-%d_%H%M%S)
      cp "{{db_path}}" "{{backup_dir}}/events-pre-restore-${ts}.db"
      echo "Current DB backed up → backups/events-pre-restore-${ts}.db"
    fi
    rm -f "{{db_path}}" "{{db_path}}-wal" "{{db_path}}-shm"
    cp "$src" "{{db_path}}"
    echo "Restored ← backups/{{name}}"

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

# --- Hooks ---

# Install observability hooks into a target project
setup-hooks *args:
    {{project_root}}/scripts/setup-hooks.sh {{args}}

# --- Open ---

open:
    open http://localhost:{{client_port}}
