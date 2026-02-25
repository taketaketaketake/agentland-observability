import { useState, useEffect, useRef } from 'react';
import type { TranscriptMessage } from '../types';
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
  const bottomRef = useRef<HTMLDivElement>(null);

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
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
