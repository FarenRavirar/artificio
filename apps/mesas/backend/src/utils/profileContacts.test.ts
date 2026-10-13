import { describe, expect, it } from 'vitest';
import { CONTACT_CHANNELS } from './contactUrls.js';
import { isGmContactChannel, summarizeProfileContacts } from './profileContacts.js';

describe('isGmContactChannel', () => {
  it('aceita os 7 canais do perfil, inclusive phone, facebook e instagram', () => {
    for (const channel of CONTACT_CHANNELS) expect(isGmContactChannel(channel)).toBe(true);
    expect(CONTACT_CHANNELS).toHaveLength(7);
  });

  it('recusa canal fora da lista e valor que não é string', () => {
    expect(isGmContactChannel('telegram')).toBe(false);
    expect(isGmContactChannel(undefined)).toBe(false);
    expect(isGmContactChannel(['whatsapp'])).toBe(false);
  });
});

describe('summarizeProfileContacts', () => {
  it('soma por canal e no total', () => {
    expect(
      summarizeProfileContacts([
        { channel: 'whatsapp', count: 3 },
        { channel: 'instagram', count: '2' },
      ]),
    ).toEqual({ total: 5, by_channel: { whatsapp: 3, instagram: 2 } });
  });

  it('payload que não é array não derruba: devolve zero', () => {
    expect(summarizeProfileContacts(null)).toEqual({ total: 0, by_channel: {} });
    expect(summarizeProfileContacts({ channel: 'email', count: 1 })).toEqual({ total: 0, by_channel: {} });
  });

  it('descarta linha malformada, canal desconhecido e contagem inválida', () => {
    expect(
      summarizeProfileContacts([null, 'x', { channel: 'telegram', count: 4 }, { channel: 'email', count: 'abc' }, { channel: 'form', count: -1 }, { channel: 'phone', count: 1 }]),
    ).toEqual({ total: 1, by_channel: { phone: 1 } });
  });
});
