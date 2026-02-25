import { useRef, useMemo, useState } from 'react';
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
  onSelectAgent,
}: EventTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filters.sourceApp && event.source_app !== filters.sourceApp) return false;
      if (filters.sessionId && event.session_id !== filters.sessionId) return false;
      if (filters.eventType && event.hook_event_type !== filters.eventType) return false;
      return true;
    }).reverse();
  }, [events, filters]);

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvents.length;

  return (
    <div
      ref={containerRef}
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
        <>
          {visibleEvents.map((event, index) => (
            <EventRow
              key={event.id || `${event.timestamp}-${event.hook_event_type}`}
              event={event}
              index={index}
              onSelectAgent={onSelectAgent}
            />
          ))}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              className="w-full py-2 text-xs text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] hover:bg-[var(--theme-hover-bg)] transition-colors"
            >
              Load more ({filteredEvents.length - visibleCount} older events)
            </button>
          )}
        </>
      )}
    </div>
  );
}
