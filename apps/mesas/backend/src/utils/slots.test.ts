import { describe, expect, it } from 'vitest';
import { slotsAvailable } from './slots.js';

describe('slotsAvailable', () => {
  it('prefere slots_open, mesmo quando total - filled difere (mestre fechou recrutamento)', () => {
    expect(slotsAvailable({ slots_open: 1, slots_total: 5, slots_filled: 2 })).toBe(1);
  });
  it('slots_open 0 é valor, não ausência', () => {
    expect(slotsAvailable({ slots_open: 0, slots_total: 5, slots_filled: 2 })).toBe(0);
  });
  it('sem slots_open cai em total - filled', () => {
    expect(slotsAvailable({ slots_open: null, slots_total: 5, slots_filled: 2 })).toBe(3);
  });
});
