export const EMAIL_RE = /^[^\s@]{1,254}@[^\s@]{1,253}\.[^\s@]{2,}$/;
export const SCREENSHOT_RE = /^data:image\/(png|jpe?g|webp);base64,/;
export const LEVEL_MAX = 24;

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function trunc(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export function readTruncatedOrNull(value: unknown, max: number): string | null {
  const s = readString(value).trim();
  if (s.length === 0) return null;
  return trunc(s, max);
}
