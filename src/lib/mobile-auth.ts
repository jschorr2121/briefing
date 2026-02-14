import { Redis } from '@upstash/redis';
import crypto from 'crypto';

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

interface MobileSession {
  email: string;
  name?: string;
  image?: string;
  createdAt: string;
}

const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

function sessionKey(token: string) {
  return `mobile_session:${token}`;
}

export async function createMobileSession(
  email: string,
  name?: string,
  image?: string
): Promise<string> {
  const redis = getRedis();
  if (!redis) throw new Error('Redis not configured');

  const token = `brf_${crypto.randomBytes(32).toString('hex')}`;

  const session: MobileSession = {
    email: email.toLowerCase(),
    name,
    image,
    createdAt: new Date().toISOString(),
  };

  await redis.set(sessionKey(token), session, { ex: SESSION_TTL });
  return token;
}

export async function validateMobileSession(
  token: string
): Promise<{ email: string; name?: string; image?: string } | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const session = await redis.get<MobileSession>(sessionKey(token));
    if (!session) return null;
    return { email: session.email, name: session.name, image: session.image };
  } catch {
    return null;
  }
}

export async function revokeMobileSession(token: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  await redis.del(sessionKey(token));
}
