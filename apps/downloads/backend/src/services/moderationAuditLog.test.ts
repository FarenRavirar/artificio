import { logModerationAudit } from './moderationAuditLog';

// DEB-076-01 (spec 076) — log estruturado grepavel, separado de log generico.

describe('logModerationAudit', () => {
  it('emite linha JSON com prefixo [moderation-audit]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logModerationAudit({ action: 'approve', actorUserId: 'mod-1', materialId: 'material-1' });

    expect(spy).toHaveBeenCalledWith('[moderation-audit]', expect.stringContaining('"action":"approve"'));
    const [, payload] = spy.mock.calls[0] as [string, string];
    const parsed = JSON.parse(payload);
    expect(parsed.actorUserId).toBe('mod-1');
    expect(parsed.materialId).toBe('material-1');
    expect(typeof parsed.timestamp).toBe('string');

    spy.mockRestore();
  });
});
