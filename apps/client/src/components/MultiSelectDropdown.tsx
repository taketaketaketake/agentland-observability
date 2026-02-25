import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export default function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'All',
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const allSelected = selected.length === options.length && options.length > 0;

  const selectAll = () => onChange(options.map(o => o.value));
  const clearAll = () => onChange([]);

  let summary: string;
  if (selected.length === 0) {
    summary = placeholder;
  } else if (selected.length === 1) {
    const match = options.find(o => o.value === selected[0]);
    summary = match?.label ?? (selected[0]?.substring(0, 8) ?? '') + '...';
  } else {
    summary = `${selected.length} sessions`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="text-[11px] font-mono px-2.5 py-1 rounded-md border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-focus-ring)] cursor-pointer text-left min-w-[140px] flex items-center justify-between gap-1"
      >
        <span className="truncate">{summary}</span>
        <svg className={`w-3 h-3 flex-shrink-0 text-[var(--theme-text-quaternary)] transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 max-h-64 overflow-y-auto rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)] shadow-lg">
          {/* Select All / Clear controls */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--theme-border-primary)]">
            <button
              type="button"
              onClick={allSelected ? clearAll : selectAll}
              className="text-[10px] font-mono text-[var(--theme-primary)] hover:underline"
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
            {selected.length > 0 && !allSelected && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] font-mono text-[var(--theme-text-quaternary)] hover:text-[var(--theme-accent-error)]"
              >
                Clear
              </button>
            )}
          </div>

          {options.length === 0 ? (
            <div className="px-3 py-3 text-[11px] font-mono text-[var(--theme-text-quaternary)] text-center">
              No sessions available
            </div>
          ) : (
            options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--theme-bg-tertiary)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  className="w-3 h-3 rounded border-[var(--theme-border-secondary)] accent-[var(--theme-primary)]"
                />
                <span className="text-[11px] font-mono text-[var(--theme-text-secondary)] truncate">
                  {option.label}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
