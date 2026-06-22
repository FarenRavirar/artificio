import type { ConsoleErrorEntry, NetworkErrorEntry } from './types.js';
import { asRecord, readString, trunc } from './helpers.js';

export interface NormalizeOptions {
  arrayCap: number;
  messageMax: number;
  urlMax: number;
  levelMax: number;
}

export const DEFAULT_NORMALIZE_OPTIONS: NormalizeOptions = {
  arrayCap: 30,
  messageMax: 500,
  urlMax: 2000,
  levelMax: 24,
};

export function normalizeConsoleErrors(
  value: unknown,
  opts: NormalizeOptions = DEFAULT_NORMALIZE_OPTIONS,
): ConsoleErrorEntry[] {
  if (!Array.isArray(value)) return [];
  const out: ConsoleErrorEntry[] = [];
  for (const item of value) {
    if (out.length >= opts.arrayCap) break;
    const row = asRecord(item);
    if (!row) continue;
    const message = readString(row.message).trim();
    if (message.length === 0) continue;
    const level = readString(row.level).trim() || 'error';
    const ts = readString(row.ts).trim();
    out.push({
      level: trunc(level, opts.levelMax),
      message: trunc(message, opts.messageMax),
      ts: ts.length > 0 ? trunc(ts, 40) : null,
    });
  }
  return out;
}

export function normalizeNetworkErrors(
  value: unknown,
  opts: NormalizeOptions = DEFAULT_NORMALIZE_OPTIONS,
): NetworkErrorEntry[] {
  if (!Array.isArray(value)) return [];
  const out: NetworkErrorEntry[] = [];
  for (const item of value) {
    if (out.length >= opts.arrayCap) break;
    const row = asRecord(item);
    if (!row) continue;
    const url = readString(row.url).trim();
    if (url.length === 0) continue;
    if (typeof row.status !== 'number' || !Number.isFinite(row.status)) continue;
    const method = readString(row.method).trim().toUpperCase() || 'GET';
    const ts = readString(row.ts).trim();
    out.push({
      url: trunc(url, opts.urlMax),
      method: trunc(method, 10),
      status: Math.trunc(row.status),
      ts: ts.length > 0 ? trunc(ts, 40) : null,
    });
  }
  return out;
}

export function normalizeScreenshot(
  value: unknown,
  screenshotRe: RegExp,
  maxChars: number,
): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!screenshotRe.test(s)) return null;
  if (s.length > maxChars) return null;
  return s;
}
