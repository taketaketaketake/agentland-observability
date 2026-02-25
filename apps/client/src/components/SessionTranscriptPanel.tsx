import { useState, useEffect, useRef } from 'react';
import type { TranscriptMessage, SessionAnalysis } from '../types';
import { useSessionAnalysis } from '../hooks/useSessionAnalysis';
import { API_URL } from '../config';

interface SessionTranscriptPanelProps {
  sessionId: string;
  agentId: string;
  onClose: () => void;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

export default function SessionTranscriptPanel({ sessionId, agentId, onClose }: SessionTranscriptPanelProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { analysis, loading: analysisLoading, error: analysisError, reanalyze } = useSessionAnalysis(sessionId);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/transcripts/${sessionId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: TranscriptMessage[]) => {
        setMessages(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId]);

  useEffect(() => {
    if (!loading && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, messages.length]);

  const hasAnalysis = analysis && analysis.status === 'completed' && analysis.analysis_json;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl h-full flex flex-col bg-[var(--theme-bg-primary)] border-l border-[var(--theme-border-primary)] animate-slide-in-right">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)]">
          <div className="flex items-center gap-3 min-w-0">
            <svg className="w-4 h-4 text-[var(--theme-primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--theme-text-primary)] truncate">{agentId}</h2>
              <span className="text-[10px] font-mono text-[var(--theme-text-quaternary)]">{sessionId.substring(0, 8)}</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--theme-text-quaternary)] bg-[var(--theme-bg-tertiary)] px-1.5 py-0.5 rounded flex-shrink-0">
              {messages.length} msgs
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* AI Summary Button */}
            <button
              onClick={() => setShowAnalysis(v => !v)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-mono transition-colors ${
                hasAnalysis
                  ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : 'text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]'
              }`}
              title="AI Summary"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              AI Summary
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* AI Analysis Display */}
        {showAnalysis && (
          <SessionAnalysisDisplay
            analysis={analysis}
            loading={analysisLoading}
            error={analysisError}
            onReanalyze={reanalyze}
          />
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-2 text-xs text-[var(--theme-text-tertiary)]">
                <div className="w-3 h-3 border border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
                Loading transcript...
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-32">
              <div className="text-xs text-[var(--theme-accent-error)]">
                Failed to load transcript: {error}
              </div>
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <svg className="w-8 h-8 text-[var(--theme-text-quaternary)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-xs text-[var(--theme-text-tertiary)]">No transcript available</span>
              <span className="text-[10px] text-[var(--theme-text-quaternary)] mt-1">Transcripts are captured when sessions end</span>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.uuid} message={msg} />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

/* ─── AI Analysis Display ─── */

const OUTCOME_COLORS: Record<string, string> = {
  success: 'text-emerald-400 bg-emerald-500/10',
  partial: 'text-amber-400 bg-amber-500/10',
  failure: 'text-red-400 bg-red-500/10',
  abandoned: 'text-gray-400 bg-gray-500/10',
  unclear: 'text-blue-400 bg-blue-500/10',
};

const COMPLEXITY_COLORS: Record<string, string> = {
  trivial: 'text-gray-400 bg-gray-500/10',
  simple: 'text-emerald-400 bg-emerald-500/10',
  moderate: 'text-blue-400 bg-blue-500/10',
  complex: 'text-amber-400 bg-amber-500/10',
  highly_complex: 'text-red-400 bg-red-500/10',
};

function SessionAnalysisDisplay({
  analysis,
  loading,
  error,
  onReanalyze,
}: {
  analysis: SessionAnalysis | null;
  loading: boolean;
  error: string | null;
  onReanalyze: () => void;
}) {
  if (loading || (analysis && (analysis.status === 'pending' || analysis.status === 'running'))) {
    return (
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-surface)]">
        <div className="flex items-center gap-2 text-xs text-[var(--theme-text-tertiary)]">
          <div className="w-3 h-3 border border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
          Analyzing session...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-surface)]">
        <div className="text-xs text-[var(--theme-accent-error)]">Failed to load analysis: {error}</div>
      </div>
    );
  }

  if (!analysis || analysis.status === 'failed') {
    return (
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-surface)]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--theme-text-tertiary)]">
            {analysis?.error_message || 'No analysis available'}
          </span>
          <button
            onClick={onReanalyze}
            className="text-[10px] font-mono text-[var(--theme-primary)] hover:underline"
          >
            {analysis ? 'Retry' : 'Analyze'}
          </button>
        </div>
      </div>
    );
  }

  const data = analysis.analysis_json;
  if (!data) return null;

  return (
    <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-surface)] space-y-2.5 max-h-[40vh] overflow-y-auto">
      {/* Task summary */}
      <p className="text-xs text-[var(--theme-text-primary)] leading-relaxed">{data.task_summary}</p>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${OUTCOME_COLORS[data.outcome] || 'text-gray-400 bg-gray-500/10'}`}>
          {data.outcome}
        </span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${COMPLEXITY_COLORS[data.complexity] || 'text-gray-400 bg-gray-500/10'}`}>
          {data.complexity}
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-yellow-400 bg-yellow-500/10">
          {data.quality_score}/5
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-[var(--theme-text-quaternary)] bg-[var(--theme-bg-tertiary)]">
          {data.duration_assessment}
        </span>
      </div>

      {/* Tags */}
      {data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.tags.map(tag => (
            <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-[var(--theme-border-secondary)] text-[var(--theme-text-tertiary)]">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Key decisions */}
      {data.key_decisions.length > 0 && (
        <div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--theme-text-quaternary)]">Key decisions</span>
          <ul className="mt-0.5 space-y-0.5">
            {data.key_decisions.map((d, i) => (
              <li key={i} className="text-[10px] text-[var(--theme-text-secondary)] pl-2 border-l border-[var(--theme-border-secondary)]">{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues */}
      {data.issues.length > 0 && (
        <div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--theme-text-quaternary)]">Issues</span>
          <ul className="mt-0.5 space-y-0.5">
            {data.issues.map((issue, i) => (
              <li key={i} className="text-[10px] text-red-400/80 pl-2 border-l border-red-500/20">{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Re-analyze button */}
      <div className="flex items-center justify-between pt-1">
        {analysis.model_name && (
          <span className="text-[9px] font-mono text-[var(--theme-text-quaternary)]">
            via {analysis.model_name}
          </span>
        )}
        <button
          onClick={onReanalyze}
          className="text-[10px] font-mono text-[var(--theme-primary)] hover:underline"
        >
          Re-analyze
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: TranscriptMessage }) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Role label + timestamp */}
        <div className={`flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className={`text-[9px] font-mono font-semibold tracking-widest uppercase ${
            isUser ? 'text-[var(--theme-accent-info)]' : 'text-[var(--theme-primary)]'
          }`}>
            {isUser ? 'USER' : 'ASSISTANT'}
          </span>
          <span className="text-[9px] font-mono text-[var(--theme-text-quaternary)]">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {/* Content bubble */}
        <div className={`rounded-lg px-3 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-[rgba(106,159,216,0.12)] border border-[rgba(106,159,216,0.2)] text-[var(--theme-text-primary)]'
            : 'bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-primary)] text-[var(--theme-text-primary)]'
        }`}>
          {/* Thinking block (assistant only) */}
          {message.thinking && (
            <div className="mb-2">
              <button
                onClick={() => setThinkingOpen(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] transition-colors"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${thinkingOpen ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Thinking
              </button>
              {thinkingOpen && (
                <div className="mt-1.5 pl-3 border-l-2 border-[var(--theme-border-secondary)] text-xs text-[var(--theme-text-tertiary)] whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {message.thinking}
                </div>
              )}
            </div>
          )}

          <div className="whitespace-pre-wrap break-words font-mono text-xs">
            {message.content}
          </div>
        </div>

        {/* Meta row (assistant only) */}
        {!isUser && (message.model || message.input_tokens != null || message.output_tokens != null) && (
          <div className="flex items-center gap-2 px-1">
            {message.model && (
              <span className="text-[9px] font-mono text-[var(--theme-text-quaternary)]">
                {message.model}
              </span>
            )}
            {message.input_tokens != null && (
              <span className="text-[9px] font-mono text-[var(--theme-text-quaternary)]">
                in:{formatTokens(message.input_tokens)}
              </span>
            )}
            {message.output_tokens != null && (
              <span className="text-[9px] font-mono text-[var(--theme-text-quaternary)]">
                out:{formatTokens(message.output_tokens)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
