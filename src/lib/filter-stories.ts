/**
 * Post-processing date filter for generated stories.
 * Drops stories older than 2 months or with future (hallucinated) dates.
 * Stories with missing or unparseable dates are kept.
 */
export function filterRecentStories<T extends { headline?: string; date?: string }>(
  stories: T[]
): T[] {
  const now = new Date();
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  return stories.filter(story => {
    if (!story.date) return true;

    const parsed = new Date(story.date);
    if (isNaN(parsed.getTime())) return true;

    if (parsed > now) {
      console.warn(`⚠️ Filtered out future-dated story: "${story.headline}" (date: ${story.date})`);
      return false;
    }

    if (parsed < twoMonthsAgo) {
      console.warn(`⚠️ Filtered out old story: "${story.headline}" (date: ${story.date})`);
      return false;
    }

    return true;
  });
}

/**
 * Sort stories by date, newest first.
 * Stories with missing or unparseable dates are pushed to the end.
 */
export function sortStoriesByRecency<T extends { date?: string }>(stories: T[]): T[] {
  return [...stories].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    // NaN check: treat unparseable as 0 (pushed to end)
    const timeA = isNaN(dateA) ? 0 : dateA;
    const timeB = isNaN(dateB) ? 0 : dateB;
    return timeB - timeA;
  });
}
