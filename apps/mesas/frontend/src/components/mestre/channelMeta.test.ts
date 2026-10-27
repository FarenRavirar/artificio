import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTACT_CHANNEL_META, FALLBACK_CHANNEL_META } from './channelMeta';

/**
 * Paridade com o backend (spec 106 R17), no molde de `linkTypes.test.ts`: o backend
 * grava o canal que `CONTACT_CHANNELS` lista e o frontend precisa ter metadado para
 * cada um. Frontend e backend do mesas nao compartilham pacote, entao le-se a FONTE.
 */
const BACKEND_CONTACT_URLS = resolve(__dirname, '../../../../backend/src/utils/contactUrls.ts');

function backendChannels(): string[] {
  const source = readFileSync(BACKEND_CONTACT_URLS, 'utf8');
  const list = /export const CONTACT_CHANNELS = \[([^\]]+)\] as const;/.exec(source);
  if (!list) throw new Error('`CONTACT_CHANNELS` não encontrado em contactUrls.ts');
  return [...list[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

describe('CONTACT_CHANNEL_META', () => {
  it('tem metadado para exatamente os canais que o backend grava', () => {
    const backend = backendChannels();
    expect(backend.length).toBeGreaterThan(0);
    expect(Object.keys(CONTACT_CHANNEL_META).sort()).toEqual([...backend].sort());
  });

  it('o fallback para canal desconhecido tem ícone renderizável', () => {
    expect(CONTACT_CHANNEL_META['mastodon' as keyof typeof CONTACT_CHANNEL_META]).toBeUndefined();
    expect(FALLBACK_CHANNEL_META.icon).toBeTruthy();
  });
});
