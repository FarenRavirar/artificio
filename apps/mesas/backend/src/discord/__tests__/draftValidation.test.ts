import { assertDraftReadyTransition } from '../draftValidation';

describe('assertDraftReadyTransition (T-F1-02)', () => {
  it('allows any patch when status is not changing to ready', () => {
    expect(assertDraftReadyTransition({
      patchStatus: undefined,
      patchPayloadMissing: ['day_of_week'],
      currentPayloadMissing: ['day_of_week'],
    })).toEqual({ allowed: true });

    expect(assertDraftReadyTransition({
      patchStatus: 'needs_review',
      patchPayloadMissing: ['x'],
      currentPayloadMissing: ['x'],
    })).toEqual({ allowed: true });

    expect(assertDraftReadyTransition({
      patchStatus: 'rejected',
      patchPayloadMissing: ['x', 'y'],
      currentPayloadMissing: ['x', 'y'],
    })).toEqual({ allowed: true });
  });

  it('allows ready when patch payload reports zero missing fields', () => {
    expect(assertDraftReadyTransition({
      patchStatus: 'ready',
      patchPayloadMissing: [],
      currentPayloadMissing: ['day_of_week'],
    })).toEqual({ allowed: true });
  });

  it('rejects ready when patch payload still has missing fields', () => {
    const result = assertDraftReadyTransition({
      patchStatus: 'ready',
      patchPayloadMissing: ['day_of_week', 'description'],
      currentPayloadMissing: [],
    });

    expect(result.allowed).toBe(false);
    expect(result.missingFields).toEqual(['day_of_week', 'description']);
    expect(result.reason).toContain('day_of_week');
    expect(result.reason).toContain('description');
    expect(result.reason).toContain("'ready'");
  });

  it('falls back to current draft missing fields when patch omits payload', () => {
    const result = assertDraftReadyTransition({
      patchStatus: 'ready',
      patchPayloadMissing: undefined,
      currentPayloadMissing: ['system_name'],
    });

    expect(result.allowed).toBe(false);
    expect(result.missingFields).toEqual(['system_name']);
  });

  it('treats null patch payload as absence and uses current draft', () => {
    const blocked = assertDraftReadyTransition({
      patchStatus: 'ready',
      patchPayloadMissing: null,
      currentPayloadMissing: ['contact_url'],
    });
    expect(blocked.allowed).toBe(false);

    const allowed = assertDraftReadyTransition({
      patchStatus: 'ready',
      patchPayloadMissing: null,
      currentPayloadMissing: [],
    });
    expect(allowed.allowed).toBe(true);
  });

  it('truncates the preview when there are more than five missing fields', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const result = assertDraftReadyTransition({
      patchStatus: 'ready',
      patchPayloadMissing: many,
      currentPayloadMissing: [],
    });

    expect(result.allowed).toBe(false);
    expect(result.missingFields).toEqual(many);
    expect(result.reason).toContain('…');
    expect(result.reason).toContain('a, b, c, d, e');
    expect(result.reason).not.toContain('a, b, c, d, e, f');
  });

  it('treats non-array missing fields as zero (defensive)', () => {
    const result = assertDraftReadyTransition({
      patchStatus: 'ready',
      patchPayloadMissing: 'not-an-array',
      currentPayloadMissing: { invalid: true },
    });
    expect(result.allowed).toBe(true);
  });
});
