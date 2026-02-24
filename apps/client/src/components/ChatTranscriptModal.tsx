import { useState, useEffect, useCallback } from 'react';

interface ChatTranscriptModalProps {
  chat: any[];
  agentId: string;
  onClose: () => void;
}

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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-blue-100 text-blue-800';
      case 'assistant':
        return 'bg-green-100 text-green-800';
      case 'system':
        return 'bg-gray-100 text-gray-800';
      case 'tool':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--theme-bg-primary)] rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)]">
          <h2 className="text-sm font-semibold text-[var(--theme-text-primary)]">
            {'\u{1F4AC}'} Chat Transcript — {agentId}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAll}
              className="text-xs px-2 py-1 rounded bg-[var(--theme-bg-tertiary)] hover:bg-[var(--theme-bg-quaternary)] text-[var(--theme-text-secondary)] transition-colors"
            >
              Copy All
            </button>
            <button
              onClick={onClose}
              className="text-lg text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] transition-colors"
            >
              {'\u2715'}
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
            className="flex-1 text-sm px-3 py-1.5 border border-[var(--theme-border-primary)] rounded-lg bg-[var(--theme-bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)]"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm px-2 py-1.5 border border-[var(--theme-border-primary)] rounded-lg bg-[var(--theme-bg-primary)]"
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
            <option value="system">System</option>
            <option value="tool">Tool</option>
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredChat.map((msg, i) => (
            <div key={i} className="flex gap-2">
              <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full h-fit ${getRoleBadge(msg.role)}`}>
                {msg.role}
              </span>
              <div className="flex-1 text-sm text-[var(--theme-text-primary)] whitespace-pre-wrap break-words bg-[var(--theme-bg-secondary)] rounded-lg p-2">
                {typeof msg.content === 'string'
                  ? msg.content
                  : JSON.stringify(msg.content, null, 2)}
              </div>
            </div>
          ))}

          {filteredChat.length === 0 && (
            <div className="text-center text-sm text-[var(--theme-text-tertiary)] py-8">
              No messages match your filters
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
