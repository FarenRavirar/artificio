import { describe, it, expect } from 'vitest';
import { isReporterAbusive, ABUSE_DISMISSED_STREAK_THRESHOLD } from './reportAbuseGuard';

describe('reportAbuseGuard', () => {
  it('nao marca abusivo com menos denuncias que o threshold', () => {
    expect(isReporterAbusive(Array(ABUSE_DISMISSED_STREAK_THRESHOLD - 1).fill('dismissed'))).toBe(false);
  });

  it('marca abusivo quando as ultimas N denuncias foram todas dismissed', () => {
    expect(isReporterAbusive(Array(ABUSE_DISMISSED_STREAK_THRESHOLD).fill('dismissed'))).toBe(true);
  });

  it('nao marca abusivo quando ha uma denuncia resolved (procedente) na sequencia recente', () => {
    const states = ['dismissed', 'resolved', 'dismissed'];
    expect(isReporterAbusive(states)).toBe(false);
  });

  it('considera so os N mais recentes mesmo com historico maior', () => {
    const states = ['dismissed', 'dismissed', 'dismissed', 'resolved', 'dismissed'];
    expect(isReporterAbusive(states)).toBe(true);
  });
});
