// Schedule storage using Upstash Redis
import { getRedis } from '@/lib/news/cache';

export interface ScheduledBrief {
  id: string;
  userId: string;
  email: string;
  topics: string[];
  frequency: 'daily' | 'weekdays' | 'weekly';
  time: string; // HH:MM format
  timezone: string;
  enabled: boolean;
  lastSentAt?: string;
  createdAt: string;
  updatedAt: string;
}

const SCHEDULES_KEY = 'briefing:schedules';

export async function getSchedules(): Promise<ScheduledBrief[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const schedules = await redis.get<ScheduledBrief[]>(SCHEDULES_KEY);
    return schedules || [];
  } catch (error) {
    console.error('Error fetching schedules from Redis:', error);
    return [];
  }
}

export async function getSchedulesByUser(userId: string): Promise<ScheduledBrief[]> {
  const all = await getSchedules();
  return all.filter(s => s.userId === userId);
}

export async function getScheduleById(id: string): Promise<ScheduledBrief | null> {
  const all = await getSchedules();
  return all.find(s => s.id === id) || null;
}

export async function saveSchedule(schedule: ScheduledBrief): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const schedules = await getSchedules();
    const existingIndex = schedules.findIndex(s => s.id === schedule.id);
    
    if (existingIndex >= 0) {
      schedules[existingIndex] = schedule;
    } else {
      schedules.push(schedule);
    }
    
    await redis.set(SCHEDULES_KEY, schedules);
  } catch (error) {
    console.error('Error saving schedule to Redis:', error);
    throw error;
  }
}

export async function deleteSchedule(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const schedules = await getSchedules();
    const filtered = schedules.filter(s => s.id !== id);
    await redis.set(SCHEDULES_KEY, filtered);
  } catch (error) {
    console.error('Error deleting schedule from Redis:', error);
    throw error;
  }
}

export async function markScheduleSent(id: string): Promise<void> {
  const s = await getScheduleById(id);
  if (s) await saveSchedule({ ...s, lastSentAt: new Date().toISOString() });
}

export function shouldSendNow(schedule: ScheduledBrief): boolean {
  if (!schedule.enabled) return false;
  
  const now = new Date();
  if (schedule.lastSentAt?.slice(0, 10) === now.toISOString().slice(0, 10)) return false;

  // Convert to user's timezone for day-of-week check
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: schedule.timezone }));
  const currentDay = userTime.getDay(); // 0 = Sunday
  
  // Two Vercel crons run once per day: generate-briefs, then send-briefs.
  // lastSentAt (UTC date) guards against double sends.
  
  // Check frequency (day of week)
  if (schedule.frequency === 'weekdays' && (currentDay === 0 || currentDay === 6)) {
    return false;
  }
  if (schedule.frequency === 'weekly' && currentDay !== 1) { // Monday only
    return false;
  }
  
  return true;
}
