import { describe, expect, it } from 'vitest';
import { canDeleteComment } from './commentPermissions.js';

describe('moderação global de comentário no glossário', () => {
  it('permite autor, admin local e moderator global', () => {
    expect(canDeleteComment({ actorId: 'u1', ownerId: 'u1', localRole: 'user', isGlobalModerator: false })).toBe(true);
    expect(canDeleteComment({ actorId: 'u2', ownerId: 'u1', localRole: 'admin', isGlobalModerator: false })).toBe(true);
    expect(canDeleteComment({ actorId: 'u2', ownerId: 'u1', localRole: 'user', isGlobalModerator: true })).toBe(true);
  });

  it('não promove usuário comum nem papel editorial local', () => {
    expect(canDeleteComment({ actorId: 'u2', ownerId: 'u1', localRole: 'user', isGlobalModerator: false })).toBe(false);
    expect(canDeleteComment({ actorId: 'u2', ownerId: 'u1', localRole: 'editor', isGlobalModerator: false })).toBe(false);
  });
});
