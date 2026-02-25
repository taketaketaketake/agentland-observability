interface ThemeManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThemeManager({ isOpen, onClose }: ThemeManagerProps) {
  if (!isOpen) return null;

  const vars = [
    ['--theme-primary', 'Primary accent'],
    ['--theme-bg-primary', 'Background'],
    ['--theme-bg-secondary', 'Surface'],
    ['--theme-text-primary', 'Text'],
    ['--theme-accent-success', 'Success'],
    ['--theme-accent-error', 'Error'],
    ['--theme-accent-warning', 'Warning'],
    ['--theme-accent-info', 'Info'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--theme-bg-secondary)] rounded-xl border border-[var(--theme-border-secondary)] shadow-2xl w-[90vw] max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border-primary)]">
          <span className="text-xs font-mono font-medium text-[var(--theme-text-primary)]">
            Theme
          </span>
          <button
            onClick={onClose}
            className="text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-[11px] font-mono text-[var(--theme-text-tertiary)] mb-4">
            Edit CSS variables in <code className="text-[var(--theme-primary)] bg-[var(--theme-bg-primary)] px-1 py-0.5 rounded text-[10px]">index.css</code> to customize.
          </p>

          <div className="space-y-1.5">
            {vars.map(([varName, label]) => (
              <div key={varName} className="flex items-center gap-2.5 py-1">
                <div
                  className="w-4 h-4 rounded border border-[var(--theme-border-secondary)] flex-shrink-0"
                  style={{ backgroundColor: `var(${varName})` }}
                />
                <span className="text-[10px] font-mono text-[var(--theme-text-tertiary)] w-16">{label}</span>
                <span className="text-[10px] font-mono text-[var(--theme-text-quaternary)]">{varName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
