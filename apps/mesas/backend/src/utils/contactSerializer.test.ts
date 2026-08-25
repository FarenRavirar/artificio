import { serializeContactMethods, serializeContacts } from './contactSerializer.js';

describe('serialização segura de contatos legados', () => {
  it.each(['javascript:alert(1)', 'data:text/html,x', 'vbscript:msgbox(1)', 'http://forms.gle/abc'])(
    'remove formulário com URL insegura: %s',
    (value) => {
      expect(serializeContacts([{ channel: 'form', value }])).toEqual([]);
    },
  );

  it('canonicaliza formulário legado sem esquema', () => {
    expect(serializeContacts([{ channel: 'form', value: 'forms.gle/abc' }])).toEqual([
      { channel: 'form', value: 'https://forms.gle/abc', discord_server_url: null },
    ]);
  });

  it.each(['facebook', 'instagram'])(
    'remove URL insegura do canal navegável %s',
    (channel) => {
      expect(serializeContacts([{ channel, value: 'javascript:alert(1)' }])).toEqual([]);
    },
  );

  it('neutraliza servidor Discord inválido sem remover username', () => {
    expect(serializeContacts([{
      channel: 'discord',
      value: 'mestre',
      discord_server_url: 'javascript:alert(1)',
    }])).toEqual([{
      channel: 'discord',
      value: 'mestre',
      discord_server_url: null,
    }]);
  });

  it('canonicaliza convite Discord sem esquema', () => {
    expect(serializeContacts([{
      channel: 'discord',
      value: 'mestre',
      discord_server_url: 'discord.gg/abc',
    }])[0]?.discord_server_url).toBe('https://discord.gg/abc');
  });

  it('trata JSONB fora do contrato como lista vazia', () => {
    expect(serializeContactMethods({ channel: 'form', value: 'https://example.com' })).toEqual([]);
  });

  // T4.0r (spec 096 R12, decisão 2026-08-24): o perfil passa a aceitar os
  // MESMOS 7 canais da mesa. Antes, estes três canais eram descartados EM
  // SILÊNCIO aqui (o dado entrava no banco e sumia na leitura, sem erro).
  it.each([
    ['whatsapp', '+5511999999999'],
    ['discord', 'mestre'],
    ['phone', '+55 11 99999-9999'],
    ['email', 'mestre@exemplo.com'],
  ])('serializa %s no perfil do mestre', (channel, value) => {
    expect(serializeContactMethods([{ channel, value }])).toEqual([
      { channel, value, discord_server_url: null },
    ]);
  });

  it.each([
    ['facebook', 'facebook.com/mestre', 'https://facebook.com/mestre'],
    ['instagram', 'instagram.com/mestre', 'https://instagram.com/mestre'],
    ['form', 'forms.gle/abc', 'https://forms.gle/abc'],
  ])('canonicaliza %s no perfil do mestre', (channel, value, expected) => {
    expect(serializeContactMethods([{ channel, value }])).toEqual([
      { channel, value: expected, discord_server_url: null },
    ]);
  });

  it('continua descartando canal FORA dos 7 (dado legado de enum futuro)', () => {
    expect(serializeContactMethods([{ channel: 'telegram', value: 'mestre' }])).toEqual([]);
  });
});
