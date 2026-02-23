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
