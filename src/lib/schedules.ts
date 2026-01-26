// Schedule storage using Vercel KV or fallback to in-memory
// In production, use Vercel KV: npm install @vercel/kv

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

// In-memory store for development (replace with Vercel KV in production)
let scheduleStore: Map<string, ScheduledBrief> = new Map();

export async function getSchedules(): Promise<ScheduledBrief[]> {
  // TODO: Replace with Vercel KV
  // import { kv } from '@vercel/kv';
  // const schedules = await kv.get<ScheduledBrief[]>('schedules') || [];
  return Array.from(scheduleStore.values());
}

export async function getSchedulesByUser(userId: string): Promise<ScheduledBrief[]> {
  const all = await getSchedules();
  return all.filter(s => s.userId === userId);
}

export async function getScheduleById(id: string): Promise<ScheduledBrief | null> {
  return scheduleStore.get(id) || null;
}

export async function saveSchedule(schedule: ScheduledBrief): Promise<void> {
  scheduleStore.set(schedule.id, schedule);
  // TODO: Replace with Vercel KV
  // await kv.set('schedules', Array.from(scheduleStore.values()));
}

export async function deleteSchedule(id: string): Promise<void> {
  scheduleStore.delete(id);
  // TODO: Replace with Vercel KV
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
