interface StickScrollButtonProps {
  stickToBottom: boolean;
  onToggle: () => void;
}

export default function StickScrollButton({ stickToBottom, onToggle }: StickScrollButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`fixed bottom-4 right-4 mobile:bottom-3 mobile:right-3 p-2 rounded-lg transition-all duration-200 border backdrop-blur-sm ${
        stickToBottom
          ? 'bg-[var(--theme-primary)] text-[var(--theme-bg-primary)] border-[var(--theme-primary-dark)] shadow-lg'
          : 'bg-[var(--theme-bg-elevated)] text-[var(--theme-text-tertiary)] border-[var(--theme-border-secondary)] hover:text-[var(--theme-text-secondary)] hover:border-[var(--theme-border-tertiary)]'
      }`}
      style={stickToBottom ? { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' } : {}}
      title={stickToBottom ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </button>
  );
}
