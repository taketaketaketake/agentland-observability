import { useState, useEffect } from 'react';
import type { Filters, FilterOptions } from '../types';
import { API_URL } from '../config';

interface FilterPanelProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export default function FilterPanel({ filters, onFiltersChange }: FilterPanelProps) {
  const [options, setOptions] = useState<FilterOptions>({
    source_apps: [],
    session_ids: [],
    hook_event_types: [],
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch(`${API_URL}/events/filter-options`);
        const data: FilterOptions = await res.json();
        setOptions(data);
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };

    fetchOptions();
    const interval = setInterval(fetchOptions, 10000);
    return () => clearInterval(interval);
  }, []);

  const selectClass =
    'text-sm px-2 py-1 rounded border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)]';

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-[var(--theme-bg-tertiary)] border-b border-[var(--theme-border-primary)]">
      <span className="text-xs font-semibold text-[var(--theme-text-secondary)] uppercase tracking-wide">
        Filters
      </span>

      <select
        value={filters.sourceApp}
        onChange={(e) => onFiltersChange({ ...filters, sourceApp: e.target.value })}
        className={selectClass}
      >
        <option value="">All Apps</option>
        {options.source_apps.map((app) => (
          <option key={app} value={app}>{app}</option>
        ))}
      </select>

      <select
        value={filters.sessionId}
        onChange={(e) => onFiltersChange({ ...filters, sessionId: e.target.value })}
        className={selectClass}
      >
        <option value="">All Sessions</option>
        {options.session_ids.map((sid) => (
          <option key={sid} value={sid}>{sid.substring(0, 12)}...</option>
        ))}
      </select>

      <select
        value={filters.eventType}
        onChange={(e) => onFiltersChange({ ...filters, eventType: e.target.value })}
        className={selectClass}
      >
        <option value="">All Events</option>
        {options.hook_event_types.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>

      {(filters.sourceApp || filters.sessionId || filters.eventType) && (
        <button
          onClick={() => onFiltersChange({ sourceApp: '', sessionId: '', eventType: '' })}
          className="text-xs text-[var(--theme-accent-error)] hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
