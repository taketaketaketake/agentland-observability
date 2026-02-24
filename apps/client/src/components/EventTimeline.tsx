import { useRef, useEffect, useMemo } from 'react';
import type { HookEvent, Filters } from '../types';
import EventRow from './EventRow';

interface EventTimelineProps {
  events: HookEvent[];
  filters: Filters;
  uniqueAppNames: string[];
  allAppNames: string[];
  stickToBottom: boolean;
  onStickToBottomChange: (value: boolean) => void;
  onSelectAgent?: (agentName: string) => void;
}

export default function EventTimeline({
  events,
  filters,
  stickToBottom,
  onStickToBottomChange,
  onSelectAgent,
}: EventTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filters.sourceApp && event.source_app !== filters.sourceApp) return false;
      if (filters.sessionId && event.session_id !== filters.sessionId) return false;
      if (filters.eventType && event.hook_event_type !== filters.eventType) return false;
      return true;
    });
  }, [events, filters]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (stickToBottom && containerRef.current && !isUserScrolling.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredEvents, stickToBottom]);

  // Detect manual scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;

    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (!isAtBottom && stickToBottom) {
      isUserScrolling.current = true;
      onStickToBottomChange(false);
      setTimeout(() => { isUserScrolling.current = false; }, 100);
    } else if (isAtBottom && !stickToBottom) {
      onStickToBottomChange(true);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto bg-[var(--theme-bg-primary)]"
    >
      {filteredEvents.length === 0 ? (
        <div className="flex items-center justify-center h-full text-[var(--theme-text-tertiary)]">
          <div className="text-center">
            <div className="text-4xl mb-2">{'\u{1F4E1}'}</div>
            <div className="text-sm">Waiting for events...</div>
            <div className="text-xs mt-1">Run a Claude Code session to see hook events here</div>
          </div>
        </div>
      ) : (
        filteredEvents.map((event) => (
          <EventRow
            key={event.id || `${event.timestamp}-${event.hook_event_type}`}
            event={event}
            onSelectAgent={onSelectAgent}
          />
        ))
      )}
    </div>
  );
}
