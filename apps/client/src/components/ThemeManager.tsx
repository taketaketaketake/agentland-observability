interface ThemeManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThemeManager({ isOpen, onClose }: ThemeManagerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--theme-bg-primary)] rounded-xl shadow-2xl w-[90vw] max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)]">
          <h2 className="text-sm font-semibold text-[var(--theme-text-primary)]">
            {'\u{1F3A8}'} Theme Manager
          </h2>
          <button
            onClick={onClose}
            className="text-lg text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] transition-colors"
          >
            {'\u2715'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-center text-[var(--theme-text-tertiary)]">
            <div className="text-4xl mb-3">{'\u{1F3A8}'}</div>
            <p className="text-sm">Theme customization coming soon.</p>
            <p className="text-xs mt-1">
              Edit CSS variables in <code className="bg-[var(--theme-bg-tertiary)] px-1 rounded">index.css</code> to customize the look.
            </p>

            <div className="mt-6 text-left max-w-md mx-auto">
              <h3 className="text-xs font-semibold text-[var(--theme-text-secondary)] mb-2">Current Theme Variables</h3>
              <div className="space-y-1 text-xs font-mono">
                {[
                  ['--theme-primary', 'Primary color'],
                  ['--theme-bg-primary', 'Background'],
                  ['--theme-bg-secondary', 'Secondary bg'],
                  ['--theme-text-primary', 'Text color'],
                  ['--theme-accent-success', 'Success'],
                  ['--theme-accent-error', 'Error'],
                ].map(([varName, label]) => (
                  <div key={varName} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border border-[var(--theme-border-primary)]"
                      style={{ backgroundColor: `var(${varName})` }}
                    />
                    <span className="text-[var(--theme-text-tertiary)]">{label}:</span>
                    <span className="text-[var(--theme-text-secondary)]">{varName}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
