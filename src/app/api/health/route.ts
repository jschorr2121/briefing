import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; ms?: number; error?: string }> = {};
  
  // Check Redis connection
  const redisStart = Date.now();
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
    await redis.ping();
    checks.redis = { status: 'ok', ms: Date.now() - redisStart };
  } catch (error) {
    checks.redis = { 
      status: 'error', 
      ms: Date.now() - redisStart,
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }

  // Check environment variables
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'NEXTAUTH_SECRET',
  ];
  
  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
  checks.env = missingEnvVars.length === 0 
    ? { status: 'ok' }
    : { status: 'error', error: `Missing: ${missingEnvVars.join(', ')}` };

  // Overall health
  const allHealthy = Object.values(checks).every(c => c.status === 'ok');
  
  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  }, { 
    status: allHealthy ? 200 : 503 
  });
}
