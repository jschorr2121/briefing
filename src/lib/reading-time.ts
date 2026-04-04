/**
 * Calculate estimated reading time for text content
 * @param text - The text content to analyze
 * @param wordsPerMinute - Average reading speed (default: 225 wpm for average adult)
 * @returns Estimated reading time in minutes (rounded up)
 */
export function calculateReadingTime(text: string, wordsPerMinute: number = 225): number {
  const wordCount = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return Math.max(1, minutes); // Minimum 1 minute
}

/**
 * Format reading time for display
 * @param minutes - Reading time in minutes
 * @returns Formatted string like "3 min read" or "< 1 min read"
 */
export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return '< 1 min read';
  return `${minutes} min read`;
}

/**
 * Calculate reading time from briefing content
 * @param summary - The briefing summary text
 * @param stories - Array of story cards with bullets
 * @returns Estimated reading time in minutes
 */
export function calculateBriefingReadingTime(
  summary: string,
  stories: Array<{ bullets: string[] }>
): number {
  // Combine all text: summary + all story bullets
  const allText = [
    summary,
    ...stories.flatMap(story => story.bullets)
  ].join(' ');
  
  return calculateReadingTime(allText);
}
