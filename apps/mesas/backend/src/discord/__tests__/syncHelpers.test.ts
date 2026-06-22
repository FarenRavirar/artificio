import { isValidTime, normalizeTime } from '../syncHelpers';

describe('isValidTime', () => {
  it('accepts valid HH:MM from 00:00 to 23:59', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('08:30')).toBe(true);
    expect(isValidTime('19:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
  });

  it('accepts valid HH:MM:SS', () => {
    expect(isValidTime('19:00:00')).toBe(true);
    expect(isValidTime('23:59:59')).toBe(true);
  });

  it('rejects impossible hours (24:00, 99:99)', () => {
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('99:99')).toBe(false);
    expect(isValidTime('25:30')).toBe(false);
  });

  it('rejects impossible minutes', () => {
    expect(isValidTime('12:60')).toBe(false);
    expect(isValidTime('12:99')).toBe(false);
  });

  it('rejects invalid formats', () => {
    expect(isValidTime('')).toBe(false);
    expect(isValidTime('abc')).toBe(false);
    expect(isValidTime('20h')).toBe(false);
    expect(isValidTime(19)).toBe(false);
    expect(isValidTime(null)).toBe(false);
    expect(isValidTime(undefined)).toBe(false);
  });
});

describe('normalizeTime', () => {
  it('normalizes "19h" → "19:00"', () => {
    expect(normalizeTime('19h')).toBe('19:00');
  });

  it('normalizes "20h30" → "20:30"', () => {
    expect(normalizeTime('20h30')).toBe('20:30');
  });

  it('returns "19:00" unchanged (already valid)', () => {
    expect(normalizeTime('19:00')).toBe('19:00');
  });

  it('returns null for invalid hour (99h → 99:00 rejected by isValidTime)', () => {
    expect(normalizeTime('99h')).toBeNull();
  });

  it('returns null for invalid hour (25h30 → 25:30 rejected by isValidTime)', () => {
    expect(normalizeTime('25h30')).toBeNull();
  });

  it('returns null for invalid minute (12h99 → 12:99 rejected by isValidTime)', () => {
    expect(normalizeTime('12h99')).toBeNull();
  });

  it('returns null for non-time text', () => {
    expect(normalizeTime('noite')).toBeNull();
    expect(normalizeTime('')).toBeNull();
  });
});
