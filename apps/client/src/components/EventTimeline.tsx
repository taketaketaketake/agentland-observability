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
  onViewTranscript?: (sessionId: string, agentId: string) => void;
}

export default function EventTimeline({
  events,
  filters,
  onSelectAgent,
  onViewTranscript,
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
      className="flex-1 overflow-y-auto"
    >
      {/* Feed header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-1.5 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)]/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-semibold tracking-widest uppercase text-[var(--theme-text-tertiary)]">
            Event Feed
          </span>
          <span className="text-[10px] font-mono text-[var(--theme-text-quaternary)] tabular-nums">
            {filteredEvents.length}
          </span>
        </div>
        {(filters.sourceApp || filters.sessionId || filters.eventType) && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--theme-primary-glow)] text-[var(--theme-primary)] border border-[var(--theme-border-glow)]">
            FILTERED
          </span>
        )}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="flex items-center justify-center h-[calc(100%-32px)] text-[var(--theme-text-tertiary)]">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border border-dashed border-[var(--theme-border-secondary)] flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-[var(--theme-text-quaternary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div className="text-xs font-mono text-[var(--theme-text-tertiary)]">Waiting for events...</div>
            <div className="text-[10px] text-[var(--theme-text-quaternary)] mt-1">Run a Claude Code session to see hook events here</div>
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
              onViewTranscript={onViewTranscript}
            />
          ))}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              className="w-full py-2.5 text-[10px] font-mono text-[var(--theme-text-tertiary)] hover:text-[var(--theme-primary)] hover:bg-[var(--theme-hover-bg)] transition-all duration-150 border-t border-[var(--theme-border-primary)]"
            >
              Load {Math.min(PAGE_SIZE, filteredEvents.length - visibleCount)} more
              <span className="text-[var(--theme-text-quaternary)] ml-1">
                ({filteredEvents.length - visibleCount} remaining)
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
