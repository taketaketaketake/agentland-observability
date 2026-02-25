import { useEffect, useState } from 'react';

interface ToastNotificationProps {
  index: number;
  agentName: string;
  agentColor: string;
  onDismiss: () => void;
}

export default function ToastNotification({ index, agentName, agentColor, onDismiss }: ToastNotificationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed right-4 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      }`}
      style={{ top: `${64 + index * 52}px` }}
    >
      <div
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-elevated)] backdrop-blur-sm shadow-lg"
        style={{
          borderLeftColor: agentColor,
          borderLeftWidth: 3,
          boxShadow: `0 0 20px -5px ${agentColor}30`,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: agentColor }}
        />
        <span className="text-[11px] font-mono text-[var(--theme-text-primary)]">
          <span className="text-[var(--theme-text-tertiary)]">new agent</span>
          {' '}
          <span style={{ color: agentColor }}>{agentName}</span>
        </span>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="ml-1 text-[var(--theme-text-quaternary)] hover:text-[var(--theme-text-secondary)] transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
