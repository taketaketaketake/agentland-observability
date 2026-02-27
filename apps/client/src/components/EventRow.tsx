import { useState } from 'react';
import type { HookEvent } from '../types';
import { useEventColors } from '../hooks/useEventColors';
import { useEventEmojis } from '../hooks/useEventEmojis';
import { getEventSummary } from '../utils/eventSummary';
import { API_URL } from '../config';
import ChatTranscriptModal from './ChatTranscriptModal';

interface EventRowProps {
  event: HookEvent;
  index?: number;
  onSelectAgent?: (agentName: string) => void;
  onViewTranscript?: (sessionId: string, agentId: string) => void;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  PreToolUse: 'text-[#6a9fd8] bg-[rgba(106,159,216,0.08)] border-[rgba(106,159,216,0.15)]',
  PostToolUse: 'text-[#6dba82] bg-[rgba(109,186,130,0.08)] border-[rgba(109,186,130,0.15)]',
  PostToolUseFailure: 'text-[#c96060] bg-[rgba(201,96,96,0.08)] border-[rgba(201,96,96,0.15)]',
  Stop: 'text-[#c96060] bg-[rgba(201,96,96,0.06)] border-[rgba(201,96,96,0.12)]',
  SubagentStart: 'text-[#9b86c4] bg-[rgba(155,134,196,0.08)] border-[rgba(155,134,196,0.15)]',
  SubagentStop: 'text-[#9b86c4] bg-[rgba(155,134,196,0.06)] border-[rgba(155,134,196,0.12)]',
  UserPromptSubmit: 'text-[#d4a04a] bg-[rgba(212,160,74,0.08)] border-[rgba(212,160,74,0.15)]',
  SessionStart: 'text-[#6dba82] bg-[rgba(109,186,130,0.08)] border-[rgba(109,186,130,0.15)]',
  SessionEnd: 'text-[var(--theme-text-tertiary)] bg-[var(--theme-bg-tertiary)] border-[var(--theme-border-primary)]',
  PermissionRequest: 'text-[#d4a04a] bg-[rgba(212,160,74,0.08)] border-[rgba(212,160,74,0.15)]',
  Notification: 'text-[#6a9fd8] bg-[rgba(106,159,216,0.08)] border-[rgba(106,159,216,0.15)]',
  GitPreCommit: 'text-[#5ba8a8] bg-[rgba(91,168,168,0.08)] border-[rgba(91,168,168,0.15)]',
  GitPostCommit: 'text-[#5ba8a8] bg-[rgba(91,168,168,0.08)] border-[rgba(91,168,168,0.15)]',
  GitPrePush: 'text-[#5ba8a8] bg-[rgba(91,168,168,0.08)] border-[rgba(91,168,168,0.15)]',
  GitPostCheckout: 'text-[#5ba8a8] bg-[rgba(91,168,168,0.08)] border-[rgba(91,168,168,0.15)]',
  GitPostMerge: 'text-[#5ba8a8] bg-[rgba(91,168,168,0.08)] border-[rgba(91,168,168,0.15)]',
  GitPostRewrite: 'text-[#5ba8a8] bg-[rgba(91,168,168,0.08)] border-[rgba(91,168,168,0.15)]',
};

const DEFAULT_TYPE_COLOR = 'text-[var(--theme-text-secondary)] bg-[var(--theme-bg-tertiary)] border-[var(--theme-border-primary)]';

export default function EventRow({ event, index = 0, onSelectAgent, onViewTranscript }: EventRowProps) {
  const { getHexColorForApp } = useEventColors();
  const { getToolEmoji } = useEventEmojis();
  const [showChat, setShowChat] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [hitlResponse, setHitlResponse] = useState('');
  const [hitlSending, setHitlSending] = useState(false);

  const toolName = event.payload?.tool_name || '';
  const truncatedSession = event.session_id.substring(0, 8);
  const cwd = event.payload?.cwd || '';
  const projectName = cwd ? cwd.replace(/[/\\]+$/, '').split(/[/\\]/).pop() || '' : '';
  const agentId = projectName
    ? `${projectName}:${truncatedSession}`
    : `${event.source_app}:${truncatedSession}`;
  const hexColor = getHexColorForApp(event.source_app);
  const isHITL = !!event.humanInTheLoop;
  const hitlStatus = event.humanInTheLoopStatus?.status || 'pending';

  const timestamp = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  const payloadPreview = getEventSummary(event);
  const lastAssistantMessage = event.payload?.last_assistant_message || '';
  const typeColor = EVENT_TYPE_COLORS[event.hook_event_type] || DEFAULT_TYPE_COLOR;

  const handleHITLSubmit = async () => {
    if (!event.id || !hitlResponse.trim()) return;
    setHitlSending(true);
    try {
      await fetch(`${API_URL}/events/${event.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: hitlResponse,
          hookEvent: event,
        }),
      });
      setHitlResponse('');
    } catch (err) {
      console.error('Failed to send HITL response:', err);
    } finally {
      setHitlSending(false);
    }
  };

  return (
    <>
      <div
        className="group flex items-center gap-2 px-4 py-1.5 mobile:px-3 mobile:py-1 border-b border-[var(--theme-border-primary)] hover:bg-[var(--theme-hover-bg)] transition-colors duration-100"
        style={{
          borderLeftWidth: 2,
          borderLeftColor: index % 2 === 0 ? 'transparent' : 'transparent',
        }}
      >
        {/* Timestamp */}
        <span className="flex-shrink-0 text-[10px] font-mono text-[var(--theme-text-quaternary)] tabular-nums w-16 mobile:w-12">
          {timestamp}
        </span>

        {/* Color pip */}
        <span
          className="flex-shrink-0 w-1 h-4 rounded-full opacity-70"
          style={{ backgroundColor: hexColor }}
        />

        {/* Agent tag */}
        <button
          onClick={() => onSelectAgent?.(event.source_app)}
          className="flex-shrink-0 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border border-[var(--theme-border-secondary)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-border-tertiary)] transition-colors cursor-pointer bg-[var(--theme-bg-surface)]"
          title={`Toggle swim lane: ${event.source_app}`}
        >
          {agentId}
        </button>

        {/* Event type badge */}
        <span className={`flex-shrink-0 text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${typeColor}`}>
          {event.hook_event_type.replace(/([A-Z])/g, ' $1').trim()}
        </span>

        {/* Tool name */}
        {toolName && (
          <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-mono font-medium text-[var(--theme-accent-info)] bg-[rgba(106,159,216,0.07)] px-1.5 py-0.5 rounded border border-[rgba(106,159,216,0.12)]">
            <span className="text-xs">{getToolEmoji(toolName)}</span>
            {toolName}
          </span>
        )}

        {/* Summary */}
        <span
          className={`flex-1 text-[11px] font-mono text-[var(--theme-text-secondary)] truncate min-w-0 ${lastAssistantMessage ? 'cursor-pointer hover:text-[var(--theme-text-primary)]' : ''}`}
          onClick={() => lastAssistantMessage && setShowMessage(!showMessage)}
        >
          {lastAssistantMessage && (
            <span className="inline-block w-3 text-[9px] text-[var(--theme-text-quaternary)]">
              {showMessage ? '\u25BC' : '\u25B6'}
            </span>
          )}
          {payloadPreview}
        </span>

        {/* Chat button */}
        {event.chat && event.chat.length > 0 && (
          <button
            onClick={() => setShowChat(true)}
            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--theme-border-primary)] text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] hover:border-[var(--theme-border-secondary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {event.chat.length}
          </button>
        )}

        {/* Transcript button */}
        {onViewTranscript && (
          <button
            onClick={() => onViewTranscript(event.session_id, agentId)}
            title="View session transcript"
            className="flex-shrink-0 flex items-center text-[10px] font-mono px-1 py-0.5 rounded border border-[var(--theme-border-primary)] text-[var(--theme-text-tertiary)] hover:text-[var(--theme-primary)] hover:border-[var(--theme-border-secondary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </button>
        )}

        {/* Model name */}
        {event.model_name && (
          <span className="flex-shrink-0 text-[9px] font-mono text-[var(--theme-text-quaternary)]">
            {event.model_name}
          </span>
        )}
      </div>

      {/* Expanded assistant message */}
      {showMessage && lastAssistantMessage && (
        <div className="px-4 py-3 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-tertiary)]">
          <pre className="text-[11px] font-mono text-[var(--theme-text-secondary)] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
            {lastAssistantMessage}
          </pre>
        </div>
      )}

      {/* HITL section */}
      {isHITL && (
        <div className="mx-4 my-2 p-3 rounded-lg border border-[rgba(212,160,74,0.2)] bg-[rgba(212,160,74,0.05)]">
          <div className="text-xs font-mono font-medium text-[var(--theme-accent-warning)] mb-2">
            {event.humanInTheLoop?.question}
          </div>

          {hitlStatus === 'pending' ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={hitlResponse}
                onChange={(e) => setHitlResponse(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHITLSubmit()}
                placeholder="Type your response..."
                className="flex-1 text-xs font-mono px-3 py-1.5 border border-[var(--theme-border-secondary)] rounded-lg bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent-warning)] placeholder:text-[var(--theme-text-quaternary)]"
              />
              <button
                onClick={handleHITLSubmit}
                disabled={hitlSending || !hitlResponse.trim()}
                className="text-xs font-mono font-medium px-4 py-1.5 bg-[rgba(212,160,74,0.12)] text-[var(--theme-accent-warning)] border border-[rgba(212,160,74,0.25)] rounded-lg hover:bg-[rgba(212,160,74,0.2)] disabled:opacity-30 transition-colors"
              >
                {hitlSending ? '...' : 'Send'}
              </button>
            </div>
          ) : (
            <div className="text-xs font-mono text-[var(--theme-accent-success)] bg-[rgba(109,186,130,0.07)] px-3 py-1.5 rounded-lg border border-[rgba(109,186,130,0.15)]">
              Responded: {event.humanInTheLoopStatus?.response?.response}
            </div>
          )}
        </div>
      )}

      {/* Chat transcript modal */}
      {showChat && event.chat && (
        <ChatTranscriptModal
          chat={event.chat}
          agentId={agentId}
          onClose={() => setShowChat(false)}
        />
      )}
    </>
  );
}
