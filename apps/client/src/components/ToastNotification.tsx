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
    // Animate in
    requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 4 seconds
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
      style={{ top: `${80 + index * 60}px` }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)]"
        style={{ borderLeftColor: agentColor, borderLeftWidth: 4 }}
      >
        <span className="text-sm">{'\u{1F680}'}</span>
        <span className="text-sm font-medium text-[var(--theme-text-primary)]">
          New agent: <span style={{ color: agentColor }}>{agentName}</span>
        </span>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="ml-2 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] transition-colors"
        >
          {'\u2715'}
        </button>
      </div>
    </div>
  );
}
