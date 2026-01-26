// Schedule storage using Upstash Redis
import { Redis } from '@upstash/redis';

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

// Initialize Redis client (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SCHEDULES_KEY = 'briefing:schedules';

export async function getSchedules(): Promise<ScheduledBrief[]> {
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
  try {
    const schedules = await getSchedules();
    const filtered = schedules.filter(s => s.id !== id);
    await redis.set(SCHEDULES_KEY, filtered);
  } catch (error) {
    console.error('Error deleting schedule from Redis:', error);
    throw error;
  }
}

export function shouldSendNow(schedule: ScheduledBrief): boolean {
  if (!schedule.enabled) return false;
  
  const now = new Date();
  
  // Convert to user's timezone
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: schedule.timezone }));
  const currentHour = userTime.getHours();
  const currentMinute = userTime.getMinutes();
  const currentDay = userTime.getDay(); // 0 = Sunday
  
  const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
  
  // Check if current time matches schedule time (within 30 min window)
  const timeDiff = Math.abs((currentHour * 60 + currentMinute) - (scheduleHour * 60 + scheduleMinute));
  if (timeDiff > 30) return false;
  
  // Check frequency
  if (schedule.frequency === 'weekdays' && (currentDay === 0 || currentDay === 6)) {
    return false;
  }
  if (schedule.frequency === 'weekly' && currentDay !== 1) { // Monday only
    return false;
  }
  
  // Check if already sent today
  if (schedule.lastSentAt) {
    const lastSent = new Date(schedule.lastSentAt);
    const lastSentDate = lastSent.toDateString();
    const todayDate = userTime.toDateString();
    if (lastSentDate === todayDate) return false;
  }
  
  return true;
}
