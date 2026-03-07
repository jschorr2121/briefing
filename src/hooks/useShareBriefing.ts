import { useState } from 'react';

interface ShareResult {
  url: string;
  id: string;
}

export function useShareBriefing() {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const shareBriefing = async (briefings: any[], topicNames?: string[]) => {
    setIsSharing(true);
    setShareError(null);
    setShareUrl(null);

    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefings,
          topicNames: topicNames || briefings.map((b: any) => b.topic),
          generatedAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create share link');
      }

      const data: ShareResult = await res.json();
      setShareUrl(data.url);

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(data.url);
      } catch {
        // Clipboard not available, URL is still in state
      }

      // Try native share if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Briefing: ${(topicNames || briefings.map((b: any) => b.topic)).join(', ')}`,
            url: data.url,
          });
        } catch {
          // User cancelled share — that's fine, URL is copied
        }
      }

      return data.url;
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to share');
      return null;
    } finally {
      setIsSharing(false);
    }
  };

  const clearShare = () => {
    setShareUrl(null);
    setShareError(null);
  };

  return { shareBriefing, isSharing, shareUrl, shareError, clearShare };
}
