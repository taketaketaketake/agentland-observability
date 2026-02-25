# AgentLand Observability System (React)
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

# Export a session to a standalone .db file (does NOT delete from main DB)
db-archive session_id:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p "{{backup_dir}}"
    db="{{db_path}}"
    sid="{{session_id}}"
    if [[ ! -f "$db" ]]; then
      echo "No database found at $db"
      exit 1
    fi
    # Check session exists
    count=$(sqlite3 "$db" "SELECT COUNT(*) FROM events WHERE session_id='${sid}';")
    if [[ "$count" == "0" ]]; then
      echo "No events found for session: ${sid}"
      exit 1
    fi
    msg_count=$(sqlite3 "$db" "SELECT COUNT(*) FROM messages WHERE session_id='${sid}';")
    ts=$(date +%Y-%m-%d_%H%M%S)
    short="${sid:0:8}"
    archive="{{backup_dir}}/archive-${short}-${ts}.db"
    # Create archive with same schema
    sqlite3 "$archive" "$(sqlite3 "$db" ".schema events")"
    sqlite3 "$archive" "$(sqlite3 "$db" ".schema messages")"
    sqlite3 "$archive" "$(sqlite3 "$db" ".schema evaluation_results")"
    sqlite3 "$archive" "$(sqlite3 "$db" ".schema session_analyses")"
    # Export data
    sqlite3 "$db" ".mode insert events" "SELECT * FROM events WHERE session_id='${sid}';" | sqlite3 "$archive"
    sqlite3 "$db" ".mode insert messages" "SELECT * FROM messages WHERE session_id='${sid}';" | sqlite3 "$archive"
    sqlite3 "$db" ".mode insert evaluation_results" "SELECT * FROM evaluation_results WHERE session_id='${sid}';" | sqlite3 "$archive"
    sqlite3 "$db" ".mode insert session_analyses" "SELECT * FROM session_analyses WHERE session_id='${sid}';" | sqlite3 "$archive"
    archive_size=$(du -h "$archive" | cut -f1)
    echo "Exported session ${short}..."
    echo "  Events:   ${count}"
    echo "  Messages: ${msg_count}"
    echo "  File:     backups/$(basename "$archive") (${archive_size})"
    echo ""
    echo "Data is still in the main database."
    echo "To remove it: just db-archive-delete {{session_id}}"

# Delete a session from the main DB (run db-archive first to keep a copy)
db-archive-delete session_id:
    #!/usr/bin/env bash
    set -euo pipefail
    db="{{db_path}}"
    sid="{{session_id}}"
    if [[ ! -f "$db" ]]; then
      echo "No database found at $db"
      exit 1
    fi
    count=$(sqlite3 "$db" "SELECT COUNT(*) FROM events WHERE session_id='${sid}';")
    if [[ "$count" == "0" ]]; then
      echo "No events found for session: ${sid}"
      exit 1
    fi
    msg_count=$(sqlite3 "$db" "SELECT COUNT(*) FROM messages WHERE session_id='${sid}';")
    short="${sid:0:8}"
    echo "This will delete session ${short}... from the main database:"
    echo "  Events:   ${count}"
    echo "  Messages: ${msg_count}"
    read -rp "Proceed? [y/N] " yn
    case "$yn" in
      [Yy]*)
        sqlite3 "$db" "
          DELETE FROM events WHERE session_id='${sid}';
          DELETE FROM messages WHERE session_id='${sid}';
          DELETE FROM evaluation_results WHERE session_id='${sid}';
          DELETE FROM session_analyses WHERE session_id='${sid}';
        "
        echo "Deleted. Run 'just db-vacuum' to reclaim disk space."
        ;;
      *) echo "Cancelled." ;;
    esac

# Reclaim disk space after deletes
db-vacuum:
    #!/usr/bin/env bash
    set -euo pipefail
    db="{{db_path}}"
    if [[ ! -f "$db" ]]; then
      echo "No database found at $db"
      exit 1
    fi
    before=$(du -h "$db" | cut -f1)
    sqlite3 "$db" "VACUUM;"
    after=$(du -h "$db" | cut -f1)
    echo "Vacuum complete: ${before} → ${after}"

# Print database statistics
db-stats:
    #!/usr/bin/env bash
    set -euo pipefail
    db="{{db_path}}"
    if [[ ! -f "$db" ]]; then
      echo "No database found"
      exit 0
    fi
    size=$(du -h "$db" | cut -f1)
    echo "Database: $db (${size})"
    echo ""
    sqlite3 "$db" "
      SELECT '  events:              ' || COUNT(*) FROM events;
      SELECT '  messages:            ' || COUNT(*) FROM messages;
      SELECT '  evaluation_runs:     ' || COUNT(*) FROM evaluation_runs;
      SELECT '  evaluation_results:  ' || COUNT(*) FROM evaluation_results;
      SELECT '  evaluation_baselines:' || COUNT(*) FROM evaluation_baselines;
      SELECT '  session_analyses:    ' || COUNT(*) FROM session_analyses;
      SELECT '  cross_session_insights: ' || COUNT(*) FROM cross_session_insights;
    "
    echo ""
    sqlite3 "$db" "
      SELECT '  Sessions:     ' || COUNT(DISTINCT session_id) FROM events;
      SELECT '  Source apps:  ' || GROUP_CONCAT(source_app, ', ') FROM (SELECT DISTINCT source_app FROM events ORDER BY source_app);
      SELECT '  Oldest event: ' || datetime(MIN(timestamp)/1000, 'unixepoch', 'localtime') FROM events;
      SELECT '  Newest event: ' || datetime(MAX(timestamp)/1000, 'unixepoch', 'localtime') FROM events;
    "
    echo ""
    # Backup info
    if [[ -d "{{backup_dir}}" ]] && [[ -n "$(ls -A "{{backup_dir}}" 2>/dev/null)" ]]; then
      backup_count=$(ls "{{backup_dir}}"/*.db 2>/dev/null | wc -l | tr -d ' ')
      backup_size=$(du -sh "{{backup_dir}}" | cut -f1)
      echo "  Backups: ${backup_count} files (${backup_size} total)"
    else
      echo "  Backups: none"
    fi

# --- Testing ---

test:
    cd {{project_root}}/apps/server && bun test

test-e2e:
    cd {{project_root}}/apps/client && bunx playwright test

# Run e2e tests and append results to docs/e2e-test-log.md
test-e2e-log:
    #!/usr/bin/env bash
    set -euo pipefail
    log="{{project_root}}/docs/e2e-test-log.md"
    ts=$(date '+%Y-%m-%d %H:%M')
    commit=$(git -C "{{project_root}}" rev-parse --short HEAD 2>/dev/null || echo "uncommitted")
    # Run tests, capture output and exit code
    set +e
    output=$(cd "{{project_root}}/apps/client" && bunx playwright test 2>&1)
    exit_code=$?
    set -e
    # Parse results from the last summary line
    passed=$(echo "$output" | grep -oE '[0-9]+ passed' | head -1 || echo "0 passed")
    failed=$(echo "$output" | grep -oE '[0-9]+ failed' | head -1 || echo "")
    duration=$(echo "$output" | grep -oE '\([0-9.]+s\)' | tail -1 || echo "")
    if [[ $exit_code -eq 0 ]]; then
      status="PASS"
    else
      status="FAIL"
    fi
    # Count test files
    test_files=$(ls "{{project_root}}/apps/client/e2e/"*.spec.ts 2>/dev/null | wc -l | tr -d ' ')
    # Build result line
    result="| ${ts} | \`${commit}\` | **${status}** | ${passed}${failed:+, ${failed}} | ${test_files} files | ${duration} |"
    # Create file with header if it doesn't exist
    if [[ ! -f "$log" ]]; then
      cat > "$log" << 'HEADER'
    # E2E Test Log

    Results from `just test-e2e-log`. Each row is one full Playwright run.

    | Date | Commit | Status | Results | Specs | Duration |
    |------|--------|--------|---------|-------|----------|
    HEADER
      # Strip leading whitespace from heredoc
      sed -i '' 's/^    //' "$log"
    fi
    # Append result
    echo "$result" >> "$log"
    # Print summary
    echo ""
    echo "=== E2E Test Result ==="
    echo "  Status:   ${status}"
    echo "  Results:  ${passed}${failed:+, ${failed}}"
    echo "  Specs:    ${test_files} files"
    echo "  Duration: ${duration}"
    echo "  Logged:   docs/e2e-test-log.md"
    echo ""
    # Show failures if any
    if [[ $exit_code -ne 0 ]]; then
      echo "--- Failures ---"
      echo "$output" | grep -A 5 '^\s*[0-9]*) ' || true
      exit 1
    fi

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
