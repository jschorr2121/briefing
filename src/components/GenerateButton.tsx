'use client';

import { Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GenerateButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export function GenerateButton({ onClick, isLoading, disabled }: GenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label={isLoading ? "Generating briefing..." : "Generate briefing (Ctrl+G)"}
      className={cn(
        'btn-primary px-8 py-4 rounded-xl font-semibold text-base',
        'flex items-center gap-3',
        disabled && 'opacity-50 cursor-not-allowed hover:transform-none hover:shadow-none'
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Generating...</span>
        </>
      ) : (
        <>
          <Zap className="w-5 h-5" />
          <span>Generate Briefing</span>
          <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-xs rounded bg-white/20 font-mono">⌘G</kbd>
        </>
      )}
    </button>
  );
}
