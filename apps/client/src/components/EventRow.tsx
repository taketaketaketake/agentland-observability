import { useState } from 'react';
import type { HookEvent } from '../types';
import { useEventColors } from '../hooks/useEventColors';
import { useEventEmojis } from '../hooks/useEventEmojis';
import { API_URL } from '../config';
import ChatTranscriptModal from './ChatTranscriptModal';

interface EventRowProps {
  event: HookEvent;
  onSelectAgent?: (agentName: string) => void;
}

export default function EventRow({ event, onSelectAgent }: EventRowProps) {
  const { getAppColor, getHexColorForApp } = useEventColors();
  const { getEventEmoji, getToolEmoji } = useEventEmojis();
  const [showChat, setShowChat] = useState(false);
  const [hitlResponse, setHitlResponse] = useState('');
  const [hitlSending, setHitlSending] = useState(false);

  const toolName = event.payload?.tool_name || '';
  const truncatedSession = event.session_id.substring(0, 8);
  const agentId = `${event.source_app}:${truncatedSession}`;
  const appColor = getAppColor(event.source_app);
  const hexColor = getHexColorForApp(event.source_app);
  const isHITL = !!event.humanInTheLoop;
  const hitlStatus = event.humanInTheLoopStatus?.status || 'pending';

  const timestamp = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString()
    : '';

  // Build payload preview
  let payloadPreview = '';
  if (toolName) {
    const input = event.payload?.tool_input;
    if (typeof input === 'string') {
      payloadPreview = input.substring(0, 120);
    } else if (input?.command) {
      payloadPreview = input.command.substring(0, 120);
    } else if (input?.file_path) {
      payloadPreview = input.file_path;
    } else if (input?.pattern) {
      payloadPreview = input.pattern;
    }
  }

  if (event.summary) {
    payloadPreview = event.summary;
  }

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
      <div className="group flex items-start gap-2 px-3 py-2 mobile:px-2 mobile:py-1.5 hover:bg-[var(--theme-hover-bg)] border-b border-[var(--theme-border-primary)] transition-colors">
        {/* Emoji */}
        <span className="text-lg mobile:text-sm flex-shrink-0 mt-0.5">
          {toolName ? getToolEmoji(toolName) : getEventEmoji(event.hook_event_type)}
        </span>

        {/* Agent tag */}
        <button
          onClick={() => onSelectAgent?.(event.source_app)}
          className={`flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${appColor}`}
          style={{ borderLeftColor: hexColor, borderLeftWidth: 3 }}
          title={`Click to toggle swim lane for ${event.source_app}`}
        >
          {agentId}
        </button>

        {/* Event type badge */}
        <span className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)]">
          {event.hook_event_type}
        </span>

        {/* Tool name */}
        {toolName && (
          <span className="flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            {toolName}
          </span>
        )}

        {/* Payload preview */}
        <span className="flex-1 text-xs text-[var(--theme-text-tertiary)] truncate">
          {payloadPreview}
        </span>

        {/* Chat button */}
        {event.chat && event.chat.length > 0 && (
          <button
            onClick={() => setShowChat(true)}
            className="flex-shrink-0 text-xs px-2 py-0.5 rounded bg-[var(--theme-bg-tertiary)] hover:bg-[var(--theme-bg-quaternary)] text-[var(--theme-text-secondary)] transition-colors"
          >
            {'\u{1F4AC}'} {event.chat.length}
          </button>
        )}

        {/* Model name */}
        {event.model_name && (
          <span className="flex-shrink-0 text-[10px] text-[var(--theme-text-quaternary)] font-mono">
            {event.model_name}
          </span>
        )}

        {/* Timestamp */}
        <span className="flex-shrink-0 text-[10px] text-[var(--theme-text-quaternary)] font-mono">
          {timestamp}
        </span>
      </div>

      {/* HITL section */}
      {isHITL && (
        <div className="mx-3 mb-2 p-3 rounded-lg border-2 border-amber-300 bg-amber-50">
          <div className="text-sm font-medium text-amber-800 mb-2">
            {'\u2753'} {event.humanInTheLoop?.question}
          </div>

          {hitlStatus === 'pending' ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={hitlResponse}
                onChange={(e) => setHitlResponse(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHITLSubmit()}
                placeholder="Type your response..."
                className="flex-1 text-sm px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={handleHITLSubmit}
                disabled={hitlSending || !hitlResponse.trim()}
                className="text-sm px-4 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {hitlSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          ) : (
            <div className="text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
              {'\u2705'} Responded: {event.humanInTheLoopStatus?.response?.response}
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
