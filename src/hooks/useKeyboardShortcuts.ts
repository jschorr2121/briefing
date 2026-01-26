'use client';

import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onGenerate?: () => void;
  onSettings?: () => void;
  onExport?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const isMod = event.metaKey || event.ctrlKey;

    // Cmd/Ctrl + G: Generate
    if (isMod && event.key === 'g') {
      event.preventDefault();
      handlers.onGenerate?.();
    }

    // Cmd/Ctrl + ,: Settings
    if (isMod && event.key === ',') {
      event.preventDefault();
      handlers.onSettings?.();
    }

    // Cmd/Ctrl + E: Export
    if (isMod && event.key === 'e') {
      event.preventDefault();
      handlers.onExport?.();
    }

    // Escape: Close modals
    if (event.key === 'Escape') {
      handlers.onEscape?.();
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
