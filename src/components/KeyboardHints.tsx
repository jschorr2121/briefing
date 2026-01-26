'use client';

import { useState, useEffect } from 'react';

export function KeyboardHints() {
  const [isMac, setIsMac] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    { keys: [modKey, 'G'], action: 'Generate' },
    { keys: [modKey, ','], action: 'Settings' },
    { keys: [modKey, 'E'], action: 'Export' },
    { keys: ['Esc'], action: 'Close' },
  ];

  return (
    <>
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 left-4 p-2 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)] z-40"
        title="Keyboard shortcuts"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>

      {isVisible && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsVisible(false)} />
          <div className="fixed bottom-16 left-4 z-50 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl animate-fadeIn">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2">
              {shortcuts.map(({ keys, action }) => (
                <div key={action} className="flex items-center justify-between gap-6">
                  <span className="text-sm text-[var(--muted)]">{action}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((key, i) => (
                      <span key={i}>
                        <kbd className="px-2 py-0.5 text-xs rounded bg-[var(--card-hover)] border border-[var(--border)]">
                          {key}
                        </kbd>
                        {i < keys.length - 1 && <span className="text-[var(--muted)] mx-0.5">+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
