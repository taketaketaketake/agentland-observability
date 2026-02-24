interface StickScrollButtonProps {
  stickToBottom: boolean;
  onToggle: () => void;
}

export default function StickScrollButton({ stickToBottom, onToggle }: StickScrollButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`fixed bottom-4 right-4 mobile:bottom-3 mobile:right-3 p-2.5 rounded-full shadow-lg transition-all duration-200 border ${
        stickToBottom
          ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary-dark)] hover:bg-[var(--theme-primary-hover)]'
          : 'bg-[var(--theme-bg-primary)] text-[var(--theme-text-secondary)] border-[var(--theme-border-secondary)] hover:bg-[var(--theme-bg-tertiary)]'
      }`}
      title={stickToBottom ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
    >
      <svg
        className="w-5 h-5"
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
