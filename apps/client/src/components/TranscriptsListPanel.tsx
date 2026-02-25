import { useState, useEffect } from 'react';
import type { TranscriptSessionSummary } from '../types';
import { API_URL } from '../config';

interface TranscriptsListPanelProps {
  onViewTranscript: (sessionId: string, agentId: string) => void;
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function TranscriptsListPanel({ onViewTranscript }: TranscriptsListPanelProps) {
  const [sessions, setSessions] = useState<TranscriptSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [analyzedIds, setAnalyzedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/transcripts`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: TranscriptSessionSummary[]) => {
        setSessions(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });

    // Fetch analyzed session IDs
    fetch(`${API_URL}/session-analysis?status=completed&limit=200`)
      .then(r => r.ok ? r.json() : [])
      .then((analyses: any[]) => {
        setAnalyzedIds(new Set(analyses.map(a => a.session_id)));
      })
      .catch(() => {});
  }, []);

  const filtered = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.session_id.toLowerCase().includes(q) ||
      s.source_app.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-[var(--theme-text-tertiary)]">
          <div className="w-3 h-3 border border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
          Loading transcripts...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-xs text-[var(--theme-accent-error)]">
          Failed to load transcripts: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header + Search */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-semibold tracking-widest uppercase text-[var(--theme-text-tertiary)]">
              Transcripts
            </span>
            <span className="text-[10px] font-mono text-[var(--theme-text-quaternary)] tabular-nums">
              {filtered.length}
            </span>
          </div>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by session ID or source app..."
          className="w-full text-xs font-mono px-3 py-1.5 rounded-md border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-quaternary)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary)] focus:border-[var(--theme-primary)]"
        />
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <svg className="w-10 h-10 text-[var(--theme-text-quaternary)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-xs text-[var(--theme-text-tertiary)] font-mono">
              {search ? 'No matching transcripts' : 'No transcripts yet'}
            </span>
            <span className="text-[10px] text-[var(--theme-text-quaternary)] mt-1">
              {search ? 'Try a different search term' : 'Transcripts are captured when sessions end'}
            </span>
          </div>
        ) : (
          filtered.map(session => (
            <button
              key={session.session_id}
              onClick={() =>
                onViewTranscript(
                  session.session_id,
                  `${session.source_app}:${session.session_id.substring(0, 8)}`
                )
              }
              className="w-full text-left px-4 py-3 border-b border-[var(--theme-border-primary)] hover:bg-[var(--theme-hover-bg)] transition-colors group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border border-[var(--theme-border-secondary)] text-[var(--theme-text-secondary)] bg-[var(--theme-bg-surface)]">
                    {session.source_app}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--theme-text-quaternary)] truncate">
                    {session.session_id.substring(0, 8)}
                  </span>
                  {analyzedIds.has(session.session_id) && (
                    <span className="text-[9px] font-mono font-semibold px-1 py-0.5 rounded bg-purple-500/15 text-purple-400">
                      AI
                    </span>
                  )}
                </div>
                <svg
                  className="w-3.5 h-3.5 text-[var(--theme-text-quaternary)] group-hover:text-[var(--theme-primary)] transition-colors flex-shrink-0"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--theme-text-quaternary)]">
                <span>{session.message_count} msgs</span>
                <span className="text-[var(--theme-accent-info)]">{session.user_count} user</span>
                <span className="text-[var(--theme-primary)]">{session.assistant_count} assistant</span>
                <span className="ml-auto">{formatTime(session.first_timestamp)} — {formatTime(session.last_timestamp)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
