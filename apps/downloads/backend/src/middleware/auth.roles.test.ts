import { describe, expect, it } from 'vitest';
import { resolveDownloadsDomainRole, resolveEffectiveDownloadsRole } from './auth';

describe('precedência de papel global no downloads', () => {
  it('admin central vence papel local', () => {
    expect(resolveEffectiveDownloadsRole('admin', 'publisher')).toBe('admin');
  });

  it('moderator central recebe capacidades atuais do moderator do downloads', () => {
    expect(resolveEffectiveDownloadsRole('moderator', 'publisher')).toBe('moderator');
  });

  it('user central preserva papel de domínio local', () => {
    expect(resolveEffectiveDownloadsRole('user', 'publisher')).toBe('publisher');
  });

  it('falha local nunca promove: fallback user continua user', () => {
    expect(resolveEffectiveDownloadsRole('user', 'user')).toBe('user');
  });

  it('moderator/admin locais legados nunca viram fallback global', () => {
    expect(resolveDownloadsDomainRole('moderator')).toBe('user');
    expect(resolveDownloadsDomainRole('admin')).toBe('user');
  });
});
