import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LINK_TYPES, linkHostname, linkTypeIcon, linkTypeLabel } from './linkTypes';

/**
 * Paridade com o backend: `detectLinkType` (linkService.ts) decide o tipo ao
 * gravar o link, e o frontend precisa conhecer cada um deles. Em 2026-10-11 o
 * backend gravava `whatsapp` e a tela de edição não tinha o ícone — a aba
 * Mestre de `/perfil` caía no ErrorBoundary. Lê-se a FONTE do backend porque
 * frontend e backend do mesas não compartilham pacote de tipos.
 */
const BACKEND_LINK_SERVICE = resolve(__dirname, '../../../backend/src/services/linkService.ts');

function backendLinkTypes(): string[] {
  const source = readFileSync(BACKEND_LINK_SERVICE, 'utf8');
  const union = /export type LinkType\s*=([^;]+);/.exec(source);
  if (!union) throw new Error('`export type LinkType` não encontrado em linkService.ts');
  return [...union[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

describe('linkTypes', () => {
  it('conhece exatamente os tipos que o backend grava', () => {
    const backend = backendLinkTypes();
    expect(backend.length).toBeGreaterThan(0);
    expect([...LINK_TYPES].sort()).toEqual([...backend].sort());
  });

  it('todo tipo conhecido tem ícone e rótulo próprios', () => {
    for (const type of LINK_TYPES) {
      expect(linkTypeIcon(type)).toBeTruthy();
      expect(linkTypeLabel(type)).not.toBe('Link');
    }
  });

  it('tipo desconhecido cai no genérico', () => {
    expect(linkTypeIcon('mastodon')).toBeTruthy();
    expect(linkTypeLabel('mastodon')).toBe('Link');
  });

  it('hostname tolera URL inválida', () => {
    expect(linkHostname('https://wa.me/qr/ABC')).toBe('wa.me');
    expect(linkHostname('nao-e-url')).toBe('nao-e-url');
  });
});
