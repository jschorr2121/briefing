// Dev-mode logger for the news pipeline.
// When NEXT_PUBLIC_DEV_MODE=true, logs detailed diagnostics to both
// console and briefing/logs/news-debug.log (appended per run).
// When dev mode is off, this is a no-op.

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

const LOG_DIR = join(process.cwd(), 'logs');
const LOG_FILE = join(LOG_DIR, 'news-debug.log');

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    try {
      mkdirSync(LOG_DIR, { recursive: true });
    } catch {
      // Edge runtime or read-only filesystem — file logging will silently fail.
    }
  }
}

let logDirReady = false;

function writeToFile(line: string) {
  try {
    if (!logDirReady) {
      ensureLogDir();
      logDirReady = true;
    }
    writeFileSync(LOG_FILE, line + '\n', { flag: 'a' });
  } catch {
    // Silently swallow — file logging is best-effort.
  }
}

function ts(): string {
  return new Date().toISOString();
}

/** Log a labeled section header. */
export function logHeader(label: string) {
  if (!DEV) return;
  const line = `\n${'='.repeat(60)}\n[${ts()}] ${label}\n${'='.repeat(60)}`;
  console.log(line);
  writeToFile(line);
}

/** Log a key-value pair or a short message. */
export function log(tag: string, message: string) {
  if (!DEV) return;
  const line = `[${ts()}] [${tag}] ${message}`;
  console.log(line);
  writeToFile(line);
}

/** Log a JSON object with a label. */
export function logJson(tag: string, label: string, obj: unknown) {
  if (!DEV) return;
  const json = JSON.stringify(obj, null, 2);
  const line = `[${ts()}] [${tag}] ${label}:\n${json}`;
  console.log(line);
  writeToFile(line);
}

/** Log a separator between topics. */
export function logSeparator() {
  if (!DEV) return;
  const line = '-'.repeat(60);
  console.log(line);
  writeToFile(line);
}

export function isDevMode(): boolean {
  return DEV;
}
