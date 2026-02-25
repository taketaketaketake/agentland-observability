import { useState, useEffect, useCallback } from 'react';

interface ChatTranscriptModalProps {
  chat: any[];
  agentId: string;
  onClose: () => void;
}

const ROLE_STYLES: Record<string, string> = {
  user: 'text-[#58a6ff] bg-[rgba(88,166,255,0.1)] border-[rgba(88,166,255,0.2)]',
  assistant: 'text-[#00e5a0] bg-[rgba(0,229,160,0.1)] border-[rgba(0,229,160,0.2)]',
  system: 'text-[var(--theme-text-tertiary)] bg-[var(--theme-bg-tertiary)] border-[var(--theme-border-primary)]',
  tool: 'text-[#bc8cff] bg-[rgba(188,140,255,0.1)] border-[rgba(188,140,255,0.2)]',
};

const DEFAULT_ROLE_STYLE = 'text-[var(--theme-text-secondary)] bg-[var(--theme-bg-tertiary)] border-[var(--theme-border-primary)]';

export default function ChatTranscriptModal({ chat, agentId, onClose }: ChatTranscriptModalProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const filteredChat = chat.filter((msg) => {
    if (filterType && msg.role !== filterType) return false;
    if (search) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (!content.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const copyAll = () => {
    const text = filteredChat
      .map((msg) => {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2);
        return `[${msg.role}] ${content}`;
      })
      .join('\n\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--theme-bg-secondary)] rounded-xl border border-[var(--theme-border-secondary)] shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border-primary)]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--theme-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs font-mono font-medium text-[var(--theme-text-primary)]">
              {agentId}
            </span>
            <span className="text-[10px] font-mono text-[var(--theme-text-quaternary)]">
              {filteredChat.length} messages
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAll}
              className="text-[10px] font-mono px-2 py-1 rounded border border-[var(--theme-border-secondary)] text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors"
            >
              Copy All
            </button>
            <button
              onClick={onClose}
              className="text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--theme-border-primary)]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 text-xs font-mono px-3 py-1.5 border border-[var(--theme-border-secondary)] rounded-lg bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-focus-ring)] placeholder:text-[var(--theme-text-quaternary)]"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs font-mono px-2.5 py-1.5 border border-[var(--theme-border-secondary)] rounded-lg bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] appearance-none cursor-pointer"
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
            <option value="system">System</option>
            <option value="tool">Tool</option>
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredChat.map((msg, i) => (
            <div key={i} className="flex gap-2 animate-fade-in-up" style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}>
              <span className={`flex-shrink-0 text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border h-fit ${ROLE_STYLES[msg.role] || DEFAULT_ROLE_STYLE}`}>
                {msg.role}
              </span>
              <div className="flex-1 text-[11px] font-mono text-[var(--theme-text-secondary)] whitespace-pre-wrap break-words bg-[var(--theme-bg-primary)] rounded-lg p-2.5 border border-[var(--theme-border-primary)] leading-relaxed">
                {typeof msg.content === 'string'
                  ? msg.content
                  : JSON.stringify(msg.content, null, 2)}
              </div>
            </div>
          ))}

          {filteredChat.length === 0 && (
            <div className="text-center text-xs font-mono text-[var(--theme-text-tertiary)] py-8">
              No messages match your filters
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
